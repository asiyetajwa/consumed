// Turns an item's picture (your cut-out photo, or the real cover) into a hand-painted sticker: Muse Image repaints
// it on cream, then the browser lifts the painting off the cream, keeping its soft shadow. For food, SAM 3.1 finds
// the painted dish first, so a white bowl on cream paper keeps its rim.

import { lift } from '../shared/lift.js';
import type { Identified, PaintRequest, PaintResponse } from '../shared/types.js';
import { requestCutout } from './cutout.js';
import { loadImage } from './stickers.js';

/** A JPEG of the picture on cream, at most 640 pixels on its long side: Muse Image refuses larger inputs. */
async function asInput(src: string): Promise<string> {
  const img = await loadImage(src);
  const k = Math.min(1, 640 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
  // A cut-out has transparent corners; paint them cream, and leave some air around the item.
  const pad = Math.round(Math.max(w, h) * 0.08);
  const c = document.createElement('canvas');
  c.width = w + pad * 2; c.height = h + pad * 2;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fcf9ee';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, pad, pad, w, h);
  return c.toDataURL('image/jpeg', 0.86);
}

/** The painting, lifted off its background: a PNG with transparency and its width over height. */
export async function liftPainting(src: string, noun?: string, max = 420): Promise<{ image: string; ratio: number } | null> {
  const img = await loadImage(src);
  const k = Math.min(1, 720 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, w, h);
  const keep = noun ? await dishMask(c.toDataURL('image/jpeg', 0.88), noun, w, h) : undefined;
  const data = g.getImageData(0, 0, w, h);
  const box = lift(data.data, w, h, keep);
  if (!box) return null;
  g.putImageData(data, 0, 0);
  const [x1, y1, x2, y2] = box;
  const bw = x2 - x1, bh = y2 - y1;
  const s = Math.min(1, max / Math.max(bw, bh));
  const out = document.createElement('canvas');
  out.width = Math.round(bw * s); out.height = Math.round(bh * s);
  out.getContext('2d')!.drawImage(c, x1, y1, bw, bh, 0, 0, out.width, out.height);
  return { image: out.toDataURL('image/png'), ratio: bw / bh };
}

/** SAM 3.1's mask of the painted dish, one byte per pixel, or undefined if it found nothing. */
async function dishMask(jpeg: string, noun: string, w: number, h: number): Promise<Uint8Array | undefined> {
  const cut = await requestCutout(jpeg, [0, 0, 1000, 1000], noun);
  if (!cut) return undefined;
  const m = await loadImage(cut.mask);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(m, cut.bounds[0], cut.bounds[1]);
  const d = g.getImageData(0, 0, w, h).data;
  const keep = new Uint8Array(w * h);
  for (let i = 0; i < keep.length; i++) keep[i] = d[i * 4]! > 127 ? 1 : 0;
  return keep;
}

/** Asks Muse Image to paint the item from `src`; null when live mode is off or it fails. */
export async function requestPaint(src: string, it: Identified): Promise<{ image: string; ratio: number } | null> {
  try {
    const body: PaintRequest = { image: await asInput(src), category: it.category, kind: it.kind, title: it.title, creator: it.creator, noun: it.noun };
    const res = await fetch('api/paint', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) return null;
    const out = (await res.json()) as PaintResponse;
    return await liftPainting(out.image, it.category === 'food' ? it.noun || it.title : undefined);
  } catch {
    return null;
  }
}
