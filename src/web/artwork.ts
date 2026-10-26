// Real artwork for stickers. Catalog items use the files listed in art/manifest.json (made by
// `npm run fetch-art`); anything else asks the server, which looks in public catalogs and, for food, can have
// Muse Image picture it. Without either, stickers fall back to their painted drawing.

import type { ArtResponse, Identified } from '../shared/types.js';
import { frameFor, loadImage, type Art } from './stickers.js';

export interface CatalogArt {
  file: string;
  source: string;
  /** Set when the file is a SAM cut-out (a PNG with transparency). */
  ratio?: number;
}

let manifest: Record<string, CatalogArt> = {};
const key = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');

export async function loadManifest(): Promise<void> {
  try {
    const res = await fetch('art/manifest.json');
    if (res.ok) manifest = (await res.json()) as typeof manifest;
  } catch {
    // No artwork files: painted stickers.
  }
}

export function catalogArt(title: string): CatalogArt | undefined {
  return manifest[key(title)];
}

type Drawable = Pick<Identified, 'shape' | 'colors' | 'title' | 'creator' | 'category' | 'kind'> & { photo?: string; golden?: boolean; ratio?: number; cutout?: boolean };

/** What to draw for an item: its own photo or artwork when it has one, the catalog file otherwise. */
export function artFor(it: Drawable, override?: Partial<Art>): Art {
  if (it.photo) {
    return { shape: it.shape, colors: it.colors, title: it.title, creator: it.creator, photo: it.photo, golden: it.golden, frame: it.cutout ? 'cutout' : frameFor(it.category, it.kind), ratio: it.ratio, ...override };
  }
  const known = catalogArt(it.title);
  return { shape: it.shape, colors: it.colors, title: it.title, creator: it.creator, photo: known?.file, golden: it.golden, frame: known?.ratio ? 'cutout' : frameFor(it.category, it.kind), ratio: known?.ratio, ...override };
}

/** Asks the server for artwork; returns a small JPEG data URL and its source, or null. */
export async function fetchArt(it: Identified): Promise<{ photo: string; source: string } | null> {
  try {
    const res = await fetch('api/art', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ category: it.category, kind: it.kind, title: it.title, creator: it.creator, visual: it.visual }) });
    if (!res.ok) return null;
    const art = (await res.json()) as ArtResponse;
    return { photo: await shrink(art.image, 400), source: art.source };
  } catch {
    return null;
  }
}

/** Resizes an image to at most `max` pixels on its long side, as a JPEG data URL, so the log stays small. */
export async function shrink(src: string, max: number): Promise<string> {
  const img = await loadImage(src);
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

/** An image path as a data URL, for drawing inside an SVG on a canvas (SVG images cannot load files). */
export async function inline(src: string | undefined): Promise<string | undefined> {
  if (!src || src.startsWith('data:')) return src;
  try {
    const blob = await (await fetch(src)).blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error('read failed'));
      r.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}
