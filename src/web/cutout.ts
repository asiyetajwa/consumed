// Turns a SAM 3.1 mask into a cut-out sticker image: the item alone, on transparency, following its own outline.
// The white die-cut edge is added by the sticker's SVG filter, so photo and catalog cut-outs look the same.

import type { CutoutRequest, CutoutResponse } from '../shared/types.js';
import { loadImage } from './stickers.js';

export async function requestCutout(photo: string, box: [number, number, number, number], noun: string): Promise<CutoutResponse | null> {
  const img = await loadImage(photo);
  const body: CutoutRequest = { image: photo, width: img.naturalWidth, height: img.naturalHeight, box, noun };
  try {
    const res = await fetch('api/cutout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return res.ok ? ((await res.json()) as CutoutResponse) : null;
  } catch {
    return null;
  }
}

/** Returns a PNG with transparency, at most `max` pixels on its long side, and its width over height. */
export async function makeCutout(photo: string, cut: CutoutResponse, max = 360): Promise<{ image: string; ratio: number }> {
  const [img, mask] = await Promise.all([loadImage(photo), loadImage(cut.mask)]);
  const [x1, y1] = cut.bounds;
  const bw = mask.naturalWidth, bh = mask.naturalHeight;
  const pad = Math.round(Math.max(bw, bh) * 0.05);
  const k = Math.min(1, max / (Math.max(bw, bh) + pad * 2));
  const W = Math.round((bw + pad * 2) * k), H = Math.round((bh + pad * 2) * k);
  // The mask is white on black; turn it into an alpha channel, softened by half a pixel so edges are not jagged.
  const m = document.createElement('canvas');
  m.width = W; m.height = H;
  const mg = m.getContext('2d', { willReadFrequently: true })!;
  mg.filter = 'blur(0.6px)';
  mg.drawImage(mask, pad * k, pad * k, bw * k, bh * k);
  const data = mg.getImageData(0, 0, W, H);
  for (let i = 0; i < data.data.length; i += 4) {
    data.data[i + 3] = data.data[i]!;
    data.data[i] = data.data[i + 1] = data.data[i + 2] = 255;
  }
  mg.putImageData(data, 0, 0);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.drawImage(img, x1 - pad, y1 - pad, bw + pad * 2, bh + pad * 2, 0, 0, W, H);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(m, 0, 0);
  return { image: c.toDataURL('image/png'), ratio: W / H };
}
