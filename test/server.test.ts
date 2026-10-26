import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CATALOG, searchCatalog } from '../src/shared/catalog.js';
import { SHAPES, type Identified } from '../src/shared/types.js';
import { cardPrompt, cleanItem, Meta, picturePrompt } from '../src/server/meta.js';
import { BillingError, BudgetError, isBillingError, SpendGuard, tokenCost } from '../src/server/spend.js';

const ok = (json: unknown) => new Response(JSON.stringify(json), { status: 200 });
const item: Identified = { found: true, category: 'food', kind: 'meal', title: 'Shakshuka', creator: 'North African', detail: 'Eggs in tomato', note: 'Good pick.', shape: 'pan', colors: ['#c6341f', '#fffaf0', '#f6b52a'], colorName: 'red', visual: 'a pan of shakshuka', box: [100, 120, 900, 880] };

test('spend guard reserves the worst case and refuses past the budget', () => {
  const g = new SpendGuard(0.01, null);
  const release = g.reserve(0.008);
  assert.throws(() => g.reserve(0.003), BudgetError);
  release();
  g.record({ at: '', scope: 't', model: 'muse-spark-1.3', tokensIn: 0, tokensOut: 0, costUsd: 0.004, latencyMs: 0, ok: true });
  assert.equal(g.spent(), 0.004);
  assert.doesNotThrow(() => g.reserve(0.005)());
  assert.throws(() => g.reserve(0.007), BudgetError);
});

test('prices come from the published table and unknown models are refused', () => {
  assert.equal(tokenCost('muse-spark-1.3', 1_000_000, 1_000_000), 5.5);
  assert.throws(() => tokenCost('mystery-model', 1, 1), BudgetError);
});

test('billing errors are recognized', () => {
  assert.ok(isBillingError(402, ''));
  assert.ok(isBillingError(400, '{"error":{"message":"Insufficient credit balance"}}'));
  assert.ok(!isBillingError(400, '{"error":{"message":"bad schema"}}'));
});

test('identify sends a photo with a JSON schema and records the real cost', async () => {
  let sent: Record<string, unknown> = {};
  const fake = (async (_url: string, init: RequestInit) => {
    sent = JSON.parse(String(init.body)) as Record<string, unknown>;
    return ok({ choices: [{ message: { content: JSON.stringify(item) } }], usage: { prompt_tokens: 1200, completion_tokens: 300 } });
  }) as unknown as typeof fetch;
  const g = new SpendGuard(1, null);
  const r = await new Meta('k', g, fake).identify({ category: 'food', image: 'data:image/jpeg;base64,AAAA' });
  assert.equal(r.item.title, 'Shakshuka');
  assert.equal(sent.model, 'muse-spark-1.3');
  assert.equal((sent.response_format as { type: string }).type, 'json_schema');
  const user = (sent.messages as { role: string; content: { type: string }[] }[])[1]!;
  assert.deepEqual(user.content.map((c) => c.type), ['text', 'image_url']);
  assert.ok(Math.abs(g.spent() - tokenCost('muse-spark-1.3', 1200, 300)) < 1e-12);
});

test('a billing refusal halts every later call', async () => {
  const fake = (async () => new Response('{"error":"payment required"}', { status: 402 })) as unknown as typeof fetch;
  const g = new SpendGuard(1, null);
  const meta = new Meta('k', g, fake);
  await assert.rejects(meta.identify({ category: 'book', query: 'james' }), BillingError);
  assert.ok(g.halted());
  await assert.rejects(meta.card({ date: 'd', visuals: ['a book'] }), BillingError);
});

test('the card call asks for one image with search off, and bills only a delivered image', async () => {
  let sent: Record<string, unknown> = {};
  const g = new SpendGuard(1, null);
  const good = (async (_u: string, init: RequestInit) => { sent = JSON.parse(String(init.body)) as Record<string, unknown>; return ok({ data: [{ b64_json: 'QUJD' }] }); }) as unknown as typeof fetch;
  const r = await new Meta('k', g, good).card({ date: '2026-10-26', visuals: ['a vinyl record', 'a green book'] });
  assert.equal(r.image, 'data:image/jpeg;base64,QUJD');
  assert.equal(sent.n, 1);
  assert.deepEqual(sent.tool_enablement, { enable_web_search: false, enable_shell: false, enable_image_search: false });
  assert.equal(g.spent(), 0.01);
  const bad = (async () => new Response('oops', { status: 500 })) as unknown as typeof fetch;
  await assert.rejects(new Meta('k', g, bad).card({ date: 'd', visuals: ['x'] }));
  assert.equal(g.spent(), 0.01);
});

test('cleanItem keeps the answer drawable and strips em dashes', () => {
  const c = cleanItem({ ...item, shape: 'vinyl', colors: ['red', '#00ff00'] as unknown as Identified['colors'], note: 'Bright — and good', box: [5, 5, 2000] as unknown as Identified['box'] }, 'food');
  assert.ok((SHAPES.food as readonly string[]).includes(c.shape));
  assert.ok(c.colors.every((x) => /^#[0-9a-f]{6}$/i.test(x)));
  assert.equal(c.colors[1], '#00ff00');
  assert.ok(!c.note.includes('—'));
  assert.deepEqual(c.box, [0, 0, 1000, 1000]);
});

test('the card prompt asks for no text or logos', () => {
  assert.match(cardPrompt(['a book']), /No text, no letters/);
});

test('demo search finds catalog items and never dead-ends', () => {
  assert.equal(searchCatalog('tomorrow and tomorrow', 'book').title, 'Tomorrow, and Tomorrow, and Tomorrow');
  assert.equal(searchCatalog('ube', 'food').colorName, 'purple');
  assert.equal(searchCatalog('espresso', 'audio').creator, 'Sabrina Carpenter');
  const plain = searchCatalog('grandma’s lasagna', 'food');
  assert.equal(plain.category, 'food');
  assert.ok(plain.title.length > 0);
  for (const c of CATALOG) assert.ok((SHAPES[c.category] as readonly string[]).includes(c.shape), c.title);
  for (const c of CATALOG) assert.ok(!/—/.test(`${c.title}${c.note}${c.detail}`), c.title);
});

test('the food picture prompt asks for a plain photo with no text or people', () => {
  const p = picturePrompt('a tall iced purple latte');
  assert.match(p, /real food photograph of a tall iced purple latte/);
  assert.match(p, /No text, no logos, no hands, no people/);
});
