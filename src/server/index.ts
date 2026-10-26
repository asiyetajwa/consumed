// Serves the app and the two Meta Model API calls. With live calls off, search runs on the demo catalog and the
// day's card is composed from the stickers in the browser, so the app works end to end at no cost.

import express from 'express';
import { join } from 'node:path';
import { searchCatalog } from '../shared/catalog.js';
import type { CardRequest, IdentifyRequest, IdentifyResponse, Status } from '../shared/types.js';
import { IMAGE_MODEL, liveReason, Meta, TEXT_MODEL } from './meta.js';
import { BillingError, BudgetError, SpendGuard } from './spend.js';

const PORT = Number(process.env.PORT ?? 8791);
const HOST = process.env.HOST ?? '127.0.0.1';
const budget = Number(process.env.CONSUMED_BUDGET_USD ?? 0);
const guard = new SpendGuard(budget, process.env.CONSUMED_LEDGER?.trim() || join(process.cwd(), '.consumed-ledger.jsonl'));
const meta = liveReason() === null ? new Meta(process.env.META_API_KEY!.trim(), guard) : null;

// A small per-visitor allowance, so a public deployment cannot drain the budget.
const LIMITS = { identify: Number(process.env.CONSUMED_IDENTIFY_PER_HOUR ?? 40), card: Number(process.env.CONSUMED_CARDS_PER_HOUR ?? 4) };
const hits = new Map<string, number[]>();
function allow(kind: keyof typeof LIMITS, ip: string): boolean {
  const key = `${kind}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= LIMITS[kind]) return false;
  recent.push(now);
  hits.set(key, recent);
  return true;
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '4mb' }));

app.get('/api/status', (_req, res) => {
  const reason = guard.halted() ? `Halted after a billing error: ${guard.halted() ?? ''}` : liveReason();
  const status: Status = { live: meta !== null && !guard.halted(), reason: reason ?? 'Live: Muse Spark and Muse Image.', textModel: TEXT_MODEL, imageModel: IMAGE_MODEL, spentUsd: guard.spent(), budgetUsd: budget };
  res.set('cache-control', 'no-store').json(status);
});

app.post('/api/identify', async (req, res) => {
  const body = req.body as IdentifyRequest;
  if (!body || !['audio', 'book', 'food'].includes(body.category) || (!body.query?.trim() && !body.image)) {
    res.status(400).json({ error: 'Send a category and a search or a photo.' });
    return;
  }
  if (body.image && (!body.image.startsWith('data:image/') || body.image.length > 3_000_000)) {
    res.status(400).json({ error: 'The photo must be an image under 2 MB.' });
    return;
  }
  if (!meta) {
    if (body.image) {
      res.status(409).json({ error: 'Photo reading needs live mode. Type what it is instead.' });
      return;
    }
    const item = searchCatalog(body.query ?? '', body.category);
    const out: IdentifyResponse = { item, source: 'demo' };
    res.json(out);
    return;
  }
  if (!allow('identify', req.ip ?? '')) {
    res.status(429).json({ error: 'That is a lot of logging for one hour. Try again a little later.' });
    return;
  }
  try {
    const r = await meta.identify({ category: body.category, query: body.query?.slice(0, 200), image: body.image });
    const out: IdentifyResponse = { item: r.item, source: 'muse', model: TEXT_MODEL, costUsd: r.costUsd, latencyMs: r.latencyMs };
    res.json(out);
  } catch (e) {
    fail(res, e);
  }
});

app.post('/api/card', async (req, res) => {
  const body = req.body as CardRequest;
  if (!meta) {
    res.status(409).json({ error: 'Painting the card needs live mode.' });
    return;
  }
  if (!body || !Array.isArray(body.visuals) || body.visuals.length === 0) {
    res.status(400).json({ error: 'Log something first.' });
    return;
  }
  if (!allow('card', req.ip ?? '')) {
    res.status(429).json({ error: 'Your card was painted a few times already this hour.' });
    return;
  }
  try {
    res.json(await meta.card({ date: String(body.date).slice(0, 20), visuals: body.visuals.map((v) => String(v).slice(0, 120)).slice(0, 8) }));
  } catch (e) {
    fail(res, e);
  }
});

function fail(res: express.Response, e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(msg);
  if (e instanceof BillingError || e instanceof BudgetError) res.status(402).json({ error: 'Muse is resting for now. Your log still works.' });
  else res.status(502).json({ error: 'Muse could not read that one. Try again or type it.' });
}

app.use(express.static(join(process.cwd(), 'dist'), { maxAge: '1h' }));
app.listen(PORT, HOST, () => console.log(`Consumed: http://${HOST}:${String(PORT)} (${meta ? `live, budget $${budget.toFixed(2)}` : `demo: ${liveReason() ?? ''}`})`));
