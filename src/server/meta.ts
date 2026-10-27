// The Meta Model API, in two calls:
//   identify: Muse Spark reads a photo or a search and returns the item as JSON (structured output, so the
//             shape is guaranteed), including the box around the main subject so the photo can become a sticker.
//   card:     Muse Image paints the day's items as one illustration for the Consumed card.
// Both go through the spend guard. Nothing is called unless CONSUMED_LIVE=1 and a budget is set.

import { decodeMaskToRaster, parseImageStream, recordsOfKind } from '@meta-sam/parser';
import { ALL_SHAPES, SHAPES, type CardRequest, type CutoutResponse, type CardResponse, type IdentifyRequest, type Identified } from '../shared/types.js';
import { grayPng } from './png.js';
import { BillingError, isBillingError, PRICES, SpendGuard, tokenCost } from './spend.js';

const BASE = (process.env.META_BASE_URL?.trim() || 'https://api.meta.ai/v1').replace(/\/$/, '');
export const TEXT_MODEL = process.env.CONSUMED_TEXT_MODEL?.trim() || 'muse-spark-1.3';
export const IMAGE_MODEL = process.env.CONSUMED_IMAGE_MODEL?.trim() || 'muse-image-1.0';
export const SAM_MODEL = 'sam-3.1';
const MAX_OUT = 1500;
const TIMEOUT_MS = Number(process.env.CONSUMED_TIMEOUT_MS ?? 90_000);

export function liveReason(): string | null {
  if (!process.env.META_API_KEY?.trim()) return 'No META_API_KEY is set.';
  if (process.env.CONSUMED_LIVE !== '1') return 'Live calls are off (set CONSUMED_LIVE=1).';
  if (!(Number(process.env.CONSUMED_BUDGET_USD ?? 0) > 0)) return 'No budget is set (CONSUMED_BUDGET_USD).';
  return null;
}

export const ITEM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    found: { type: 'boolean', description: 'False when the photo or search is not a song, audiobook, book, food or drink.' },
    category: { type: 'string', enum: ['audio', 'book', 'food'] },
    kind: { type: 'string', enum: ['song', 'album', 'audiobook', 'podcast', 'book', 'meal', 'snack', 'drink', 'dessert'] },
    title: { type: 'string', description: 'The real title, or the dish name in plain English.' },
    creator: { type: 'string', description: 'Artist, author (and narrator for audiobooks), or cuisine.' },
    detail: { type: 'string', description: 'Under 9 words of plain facts.' },
    note: { type: 'string', description: 'One warm sentence, under 18 words. Never mention calories, health or guilt.' },
    shape: { type: 'string', enum: ALL_SHAPES as unknown as string[] },
    colors: { type: 'array', items: { type: 'string', description: 'Hex color like #e8432e' }, minItems: 3, maxItems: 3 },
    colorName: { type: 'string', description: 'One plain color word for the item as a whole.' },
    noun: { type: 'string', description: '1 to 4 words naming the main object as it looks in the photo, for cutting it out: "bowl of ramen", "bag of candy", "tray of fries", "book", "phone". For a search, the object you would picture.' },
    visual: { type: 'string', description: 'Under 14 words describing the physical object to paint as a sticker: for music a vinyl record, cassette or headphones in its colors; for audiobooks headphones on a book; for books the book in its cover colors; for food the dish or drink. No titles, names, words or logos.' },
    box: { type: 'array', items: { type: 'integer' }, minItems: 4, maxItems: 4, description: '[x1, y1, x2, y2] of the main subject on a 0 to 1000 grid; [0,0,1000,1000] without a photo.' },
  },
  required: ['found', 'category', 'kind', 'title', 'creator', 'detail', 'note', 'shape', 'colors', 'colorName', 'noun', 'visual', 'box'],
} as const;

const SYSTEM = `You are the eyes of Consumed, a daily log of what someone listened to, read and ate.
Identify the one item in the photo or search and return it as JSON.
- category: audio (music, audiobooks, podcasts), book, or food (meals, snacks, drinks, desserts).
- Use the real title and creator when you can tell. For a book cover, read the cover. For a dish, name it plainly.
- shape picks the sticker drawing. audio: ${SHAPES.audio.join(', ')}. book: book. food: ${SHAPES.food.join(', ')}.
- colors are the sticker's three colors, taken from the photo, cover or album when you know them.
- note is one friendly sentence a friend would say. Never mention calories, health, diet or guilt.
- Write plain English. Do not use em dashes.`;

interface ChatJson {
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class Meta {
  constructor(
    private readonly key: string,
    readonly guard: SpendGuard,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async post(path: string, body: unknown): Promise<{ json: unknown; ms: number }> {
    const t0 = Date.now();
    const res = await this.fetchImpl(`${BASE}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.key}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await res.text();
    if (!res.ok) {
      if (isBillingError(res.status, text)) {
        this.guard.halt(`HTTP ${String(res.status)} from ${path}`);
        throw new BillingError(`The Meta Model API refused for billing (HTTP ${String(res.status)}). All calls are halted.`);
      }
      throw new Error(`Meta Model API ${path} returned HTTP ${String(res.status)}: ${text.slice(0, 300)}`);
    }
    return { json: JSON.parse(text) as unknown, ms: Date.now() - t0 };
  }

  async identify(req: IdentifyRequest): Promise<{ item: Identified; costUsd: number; latencyMs: number }> {
    const userText = req.image
      ? `Category hint: ${req.category}. Identify the main item in this photo.${req.query ? ` The user adds: "${req.query}".` : ''}`
      : `Category: ${req.category}. The user searched: "${req.query ?? ''}". Identify the most likely real item.`;
    const content: unknown[] = [{ type: 'text', text: userText }];
    if (req.image) content.push({ type: 'image_url', image_url: { url: req.image } });

    // Worst case: the text plus up to ~2,500 tokens for a downsized photo, and the full output allowance.
    const inEstimate = 900 + (req.image ? 2500 : 0);
    const release = this.guard.reserve(tokenCost(TEXT_MODEL, inEstimate * 2, MAX_OUT));
    let ok = false;
    let tokensIn = 0;
    let tokensOut = 0;
    let ms = 0;
    try {
      const out = await this.post('/chat/completions', {
        model: TEXT_MODEL,
        reasoning_effort: 'low',
        max_completion_tokens: MAX_OUT,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content },
        ],
        response_format: { type: 'json_schema', json_schema: { name: 'ConsumedItem', schema: ITEM_SCHEMA } },
      });
      ms = out.ms;
      const json = out.json as ChatJson;
      tokensIn = json.usage?.prompt_tokens ?? 0;
      tokensOut = json.usage?.completion_tokens ?? 0;
      const raw = json.choices?.[0]?.message?.content ?? '';
      const item = cleanItem(JSON.parse(raw) as Identified, req.category);
      ok = true;
      return { item, costUsd: tokenCost(TEXT_MODEL, tokensIn, tokensOut), latencyMs: ms };
    } finally {
      release();
      this.guard.record({ at: new Date().toISOString(), scope: req.image ? 'identify photo' : 'identify search', model: TEXT_MODEL, tokensIn, tokensOut, costUsd: tokenCost(TEXT_MODEL, tokensIn, tokensOut), latencyMs: ms, ok });
    }
  }

  async card(req: CardRequest): Promise<CardResponse> {
    const price = PRICES['muse-image-1.0'].perImage;
    const release = this.guard.reserve(price);
    let ok = false;
    let ms = 0;
    try {
      const out = await this.post('/images/generations', {
        model: IMAGE_MODEL,
        prompt: cardPrompt(req.visuals),
        n: 1,
        size: '1024x1536',
        output_format: 'jpeg',
        response_format: 'b64_json',
        reasoning_strength: 'low',
        tool_enablement: { enable_web_search: false, enable_shell: false, enable_image_search: false },
      });
      ms = out.ms;
      const b64 = (out.json as { data?: { b64_json?: string }[] }).data?.[0]?.b64_json;
      if (!b64) throw new Error('Muse Image returned no image.');
      ok = true;
      return { image: `data:image/jpeg;base64,${b64}`, model: IMAGE_MODEL, costUsd: price, latencyMs: ms };
    } finally {
      release();
      // Muse Image is billed per image whatever happens after it renders; a refused request is not billed.
      this.guard.record({ at: new Date().toISOString(), scope: 'card', model: IMAGE_MODEL, tokensIn: 0, tokensOut: 0, costUsd: ok ? price : 0, latencyMs: ms, ok });
    }
  }

  /**
   * SAM 3.1 cuts the item out of the photo along its own outline. The prompt is the box Muse Spark found, in the
   * photo's pixels; the answer is the object's mask, sent to the browser as a small black and white PNG.
   */
  async segment(image: string, width: number, height: number, box: [number, number, number, number], noun?: string): Promise<Cutout | null> {
    const price = PRICES['sam-3.1'].perImage;
    const release = this.guard.reserve(price);
    let ok = false;
    let ms = 0;
    try {
      const px = (v: number, max: number) => Math.max(0, Math.min(max - 1, Math.round((v / 1000) * max)));
      const prompt = noun?.trim() ? noun.trim().slice(0, 60) : `<0f>1<|box;x1=${String(px(box[0], width))};y1=${String(px(box[1], height))};x2=${String(px(box[2], width))};y2=${String(px(box[3], height))};w=${String(width)};h=${String(height)}|>`;
      const t0 = Date.now();
      const res = await this.fetchImpl(`${BASE}/responses`, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.key}`, 'content-type': 'application/json', accept: 'text/event-stream' },
        body: JSON.stringify({ model: SAM_MODEL, stream: true, metadata: { mask_encoding: 'one_bit' }, input: [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: prompt }, { type: 'input_image', image_url: image }] }] }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const text = await res.text();
      ms = Date.now() - t0;
      if (!res.ok) {
        if (isBillingError(res.status, text)) {
          this.guard.halt(`HTTP ${String(res.status)} from /responses`);
          throw new BillingError(`The Meta Model API refused for billing (HTTP ${String(res.status)}). All calls are halted.`);
        }
        throw new Error(`SAM 3.1 returned HTTP ${String(res.status)}: ${text.slice(0, 300)}`);
      }
      ok = true;
      const events = text.split('\n').filter((l) => l.startsWith('data: ') && l !== 'data: [DONE]').map((l) => JSON.parse(l.slice(6)) as { type: string });
      const parsed = parseImageStream((async function* () { yield* events; })());
      const result = await parsed.finalResult;
      // A noun can match several things; keep the biggest, which is the item the photo is of.
      const mask = [...recordsOfKind(result.records, 'mask')].sort((p, q) => area(q.bounds) - area(p.bounds))[0];
      if (!mask) return null;
      const raster = solidify(decodeMaskToRaster(mask.mask), mask.mask.width, mask.mask.height);
      const gray = raster.map((v) => (v ? 255 : 0));
      if (!gray.some(Boolean)) return null;
      const png = grayPng(gray, mask.mask.width, mask.mask.height);
      return { mask: `data:image/png;base64,${png.toString('base64')}`, bounds: [mask.bounds.left, mask.bounds.top, mask.bounds.right, mask.bounds.bottom], width, height };
    } finally {
      release();
      this.guard.record({ at: new Date().toISOString(), scope: 'cutout', model: SAM_MODEL, tokensIn: 0, tokensOut: 0, costUsd: ok ? price : 0, latencyMs: ms, ok });
    }
  }

  /** A photo-style picture of one dish or drink, for food that no public catalog has a photo of. */
  async picture(visual: string): Promise<{ image: string; costUsd: number }> {
    return this.generate(picturePrompt(visual), 'picture');
  }

  /** Muse Image edits a picture (keeping everything else), through the spend guard. */
  async edit(image: string, prompt: string, scope: string): Promise<{ image: string; costUsd: number }> {
    const price = PRICES['muse-image-1.0'].perImage;
    const release = this.guard.reserve(price);
    let ok = false;
    let ms = 0;
    try {
      const out = await this.post('/images/edits', { model: IMAGE_MODEL, prompt, images: [{ image_url: image }], n: 1, output_format: 'png', response_format: 'b64_json' });
      ms = out.ms;
      const b64 = (out.json as { data?: { b64_json?: string }[] }).data?.[0]?.b64_json;
      if (!b64) throw new Error('Muse Image returned no image.');
      ok = true;
      return { image: `data:image/png;base64,${b64}`, costUsd: price };
    } finally {
      release();
      this.guard.record({ at: new Date().toISOString(), scope, model: IMAGE_MODEL, tokensIn: 0, tokensOut: 0, costUsd: ok ? price : 0, latencyMs: ms, ok });
    }
  }

  /** One square Muse Image picture from a prompt, through the spend guard. */
  async generate(prompt: string, scope: string): Promise<{ image: string; costUsd: number }> {
    const price = PRICES['muse-image-1.0'].perImage;
    const release = this.guard.reserve(price);
    let ok = false;
    let ms = 0;
    try {
      const out = await this.post('/images/generations', {
        model: IMAGE_MODEL,
        prompt,
        n: 1,
        size: '1024x1024',
        output_format: 'jpeg',
        response_format: 'b64_json',
        reasoning_strength: 'low',
        tool_enablement: { enable_web_search: false, enable_shell: false },
      });
      ms = out.ms;
      const b64 = (out.json as { data?: { b64_json?: string }[] }).data?.[0]?.b64_json;
      if (!b64) throw new Error('Muse Image returned no image.');
      ok = true;
      return { image: `data:image/jpeg;base64,${b64}`, costUsd: price };
    } finally {
      release();
      this.guard.record({ at: new Date().toISOString(), scope, model: IMAGE_MODEL, tokensIn: 0, tokensOut: 0, costUsd: ok ? price : 0, latencyMs: ms, ok });
    }
  }
}

export function picturePrompt(visual: string): string {
  return `A real food photograph of ${visual}, seen from above at a slight angle, natural daylight, on a plain light table, centered with the whole dish or cup in frame and some space around it. No text, no logos, no hands, no people.`;
}

export function cardPrompt(visuals: string[]): string {
  const list = visuals.slice(0, 8).map((v) => `- ${v}`).join('\n');
  return `A cheerful hand-painted gouache illustration of these things, each painted as a glossy die-cut sticker with a thin white border, scattered and slightly overlapping on warm cream paper, seen from above, soft shadows, bold flat colors like a modern government food poster:
${list}
Leave the top fifth of the picture as empty cream paper. No text, no letters, no numbers, no logos, no people.`;
}

/**
 * Fills enclosed gaps in a mask, so a bowl keeps its soup and a plate its food: any empty pixel that cannot reach
 * the edge of the mask through other empty pixels is part of the item.
 */
export function fillHoles(raster: Uint8Array, width: number, height: number): Uint8Array {
  const outside = new Uint8Array(raster.length);
  const queue: number[] = [];
  const push = (i: number) => {
    if (!raster[i] && !outside[i]) { outside[i] = 1; queue.push(i); }
  };
  for (let x = 0; x < width; x++) { push(x); push((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { push(y * width); push(y * width + width - 1); }
  while (queue.length) {
    const i = queue.pop()!;
    const x = i % width;
    if (x > 0) push(i - 1);
    if (x < width - 1) push(i + 1);
    if (i >= width) push(i - width);
    if (i < raster.length - width) push(i + width);
  }
  return raster.map((v, i) => (v || !outside[i] ? 1 : 0));
}

/** Max (dilate) or min (erode) over a square of side 2r+1, done as two one-dimensional passes. */
function morph(src: Uint8Array, width: number, height: number, r: number, dilate: boolean): Uint8Array {
  const pass = (input: Uint8Array, horizontal: boolean) => {
    const out = new Uint8Array(input.length);
    const [n, m] = horizontal ? [height, width] : [width, height];
    for (let line = 0; line < n; line++) {
      const at = (k: number) => (horizontal ? line * width + k : k * width + line);
      // A running count of set pixels inside the window.
      let count = 0;
      for (let k = 0; k < Math.min(r, m); k++) count += input[at(k)]!;
      for (let k = 0; k < m; k++) {
        if (k + r < m) count += input[at(k + r)]!;
        if (k - r - 1 >= 0) count -= input[at(k - r - 1)]!;
        const span = Math.min(m - 1, k + r) - Math.max(0, k - r) + 1;
        out[at(k)] = dilate ? (count > 0 ? 1 : 0) : count === span ? 1 : 0;
      }
    }
    return out;
  };
  return pass(pass(src, true), false);
}

/**
 * Makes a mask solid: closes small gaps in a rim (grow, fill, shrink back), then fills what the rim encloses,
 * so a glass keeps its latte and a pan its shakshuka.
 */
export function solidify(raster: Uint8Array, width: number, height: number): Uint8Array {
  const r = Math.max(2, Math.round(Math.max(width, height) * 0.03));
  const closed = morph(fillHoles(morph(raster, width, height, r, true), width, height), width, height, r, false);
  return fillHoles(raster.map((v, i) => v | closed[i]!), width, height);
}

const area = (b: { left: number; top: number; right: number; bottom: number }) => (b.right - b.left) * (b.bottom - b.top);

/** A cut-out: the item's mask, and where the mask sits in the photo (pixels). */
export type Cutout = CutoutResponse;

const HEX = /^#[0-9a-f]{6}$/i;

/** Keeps the model's answer inside what the stickers can draw. */
export function cleanItem(raw: Identified, fallback: IdentifyRequest['category']): Identified {
  const category = (['audio', 'book', 'food'] as const).includes(raw.category) ? raw.category : fallback;
  const allowed = SHAPES[category] as readonly string[];
  const shape = (allowed.includes(raw.shape) ? raw.shape : allowed[0]) as Identified['shape'];
  const palette: Identified['colors'] = ['#e8432e', '#f6b52a', '#2f6b2a'];
  const colors = (Array.isArray(raw.colors) ? raw.colors : []).map((c, i) => (HEX.test(String(c)) ? String(c) : palette[i] ?? '#e8432e'));
  while (colors.length < 3) colors.push(palette[colors.length] ?? '#e8432e');
  const box = Array.isArray(raw.box) && raw.box.length === 4 ? raw.box.map((n) => Math.max(0, Math.min(1000, Math.round(Number(n) || 0)))) : [0, 0, 1000, 1000];
  const strip = (s: unknown, max: number) => String(s ?? '').replace(/\s*—\s*/g, ', ').trim().slice(0, max);
  return {
    found: raw.found !== false,
    category,
    kind: strip(raw.kind, 20) || (category === 'book' ? 'book' : category === 'audio' ? 'song' : 'meal'),
    title: strip(raw.title, 80),
    creator: strip(raw.creator, 80),
    detail: strip(raw.detail, 90),
    note: strip(raw.note, 160),
    shape,
    colors: [colors[0]!, colors[1]!, colors[2]!],
    colorName: strip(raw.colorName, 20).toLowerCase(),
    noun: strip(raw.noun, 40).toLowerCase(),
    visual: strip(raw.visual, 120),
    box: [box[0]!, box[1]!, box[2]!, box[3]!],
  };
}
