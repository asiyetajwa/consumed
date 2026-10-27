// The Consumed card: one 1080 by 1920 image of the day, sized for Instagram Stories and WhatsApp.
// With live calls, the middle is Muse Image's painting of the day; without, it is the day's own stickers.

import { artFor, inline } from './artwork.js';
import { accentOf, loadImage, stickerSvg } from './stickers.js';
import type { Sticker } from './store.js';

const W = 1080, H = 1920;
const INK = '#160b06', PAPER = '#fcf9ec', TOMATO = '#e8432e', MUTED = '#8b8174';

export function summary(items: Sticker[]): string {
  const n = (c: string) => items.filter((i) => i.category === c).length;
  const parts: string[] = [];
  const a = n('audio'), b = n('book'), f = n('food');
  const word = (k: number) => ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][k] ?? String(k);
  if (a) parts.push(a === 1 ? 'a song' : `${word(a)} things to hear`);
  if (b) parts.push(b === 1 ? 'a book' : `${word(b)} books`);
  if (f) parts.push(f === 1 ? 'a bite' : `${word(f)} bites`);
  if (parts.length === 0) return 'A quiet day';
  const last = parts.pop()!;
  const text = parts.length ? `${parts.join(', ')} and ${last}` : last;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Two faces. The poster (the default): your stickers big on a green field, each with its color ring and ink
 * shadow. The painting: Muse Image's illustration of your day on cream paper.
 */
export async function renderCard(items: Sticker[], opts: { date: Date; name: string; chain: number; painting?: string }): Promise<Blob> {
  return opts.painting ? paintedCard(items, opts, opts.painting) : posterCard(items, opts);
}

const GREEN = '#2f6b2a', GREEN_DEEP = '#24561f', SUN = '#f6b52a', CREAM = '#fcf9ec';

async function posterCard(items: Sticker[], opts: { date: Date; name: string; chain: number }): Promise<Blob> {
  await document.fonts.ready;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = GREEN;
  g.fillRect(0, 0, W, H);
  g.fillStyle = GREEN_DEEP;
  g.beginPath(); g.arc(W / 2, 1010, 480, 0, Math.PI * 2); g.fill();

  g.textBaseline = 'alphabetic';
  g.fillStyle = CREAM;
  g.font = '900 150px "Inter Tight", Arial, sans-serif';
  g.fillText('Consumed', 72, 230);
  g.fillStyle = SUN;
  g.fillText(opts.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 72, 372);
  g.fillStyle = 'rgba(252, 249, 236, .75)';
  g.font = '600 40px "Inter Tight", Arial, sans-serif';
  g.fillText(summary(items), 76, 440);

  // The stickers, big, in a tight grid that overlaps a little so they read as one pile.
  const shown = items.slice(0, 6);
  const n = shown.length;
  const big = n <= 4;
  const box = n === 1 ? 640 : big ? 470 : 340;
  const spots: [number, number][] = n === 1 ? [[540, 1000]] : n === 2 ? [[330, 1000], [750, 1000]] : n === 3 ? [[320, 790], [760, 790], [540, 1230]] : big ? [[320, 790], [760, 790], [320, 1230], [760, 1230]] : [[220, 820], [540, 790], [860, 820], [220, 1170], [540, 1200], [860, 1170]];
  const tilts = [-6, 5, 4, -5, -3, 6];
  for (const [i, it] of shown.entries()) {
    const base = artFor(it);
    const art = { ...base, photo: await inline(base.photo) };
    const [, w0, h0] = stickerSvg(art, 1);
    const [svg, sw, sh] = stickerSvg(art, box / Math.max(w0, h0));
    const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    const [x, y] = spots[i]!;
    g.save();
    g.translate(x, y);
    g.rotate((tilts[i]! * Math.PI) / 180);
    g.drawImage(img, -sw / 2, -sh / 2, sw, sh);
    g.restore();
  }

  list(g, items, CREAM, 'rgba(252, 249, 236, .7)');
  footer(g, opts, CREAM);
  return toBlob(c);
}

async function paintedCard(items: Sticker[], opts: { date: Date; name: string; chain: number }, painting: string): Promise<Blob> {
  await document.fonts.ready;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = PAPER;
  g.fillRect(0, 0, W, H);

  // Title
  g.fillStyle = INK;
  g.font = '900 150px "Inter Tight", Arial, sans-serif';
  g.textBaseline = 'alphabetic';
  g.fillText('Consumed', 72, 230);
  g.fillStyle = TOMATO;
  const date = opts.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  g.fillText(date, 72, 372);
  g.fillStyle = MUTED;
  g.font = '600 40px "Inter Tight", Arial, sans-serif';
  g.fillText(summary(items), 76, 440);

  // The picture
  const px = 60, py = 500, pw = W - 120, ph = 1000;
  g.save();
  roundRect(g, px, py, pw, ph, 56);
  g.clip();
  const img = await loadImage(painting);
  const k = Math.max(pw / img.width, ph / img.height);
  g.drawImage(img, px + (pw - img.width * k) / 2, py + (ph - img.height * k) / 2, img.width * k, img.height * k);
  g.restore();

  g.restore();
  list(g, items, INK, MUTED);
  footer(g, opts, INK);
  return toBlob(c);
}

function list(g: CanvasRenderingContext2D, items: Sticker[], ink: string, muted: string) {
  g.textAlign = 'left';
  g.font = '700 38px "Inter Tight", Arial, sans-serif';
  let y = 1580;
  for (const it of items.slice(0, 4)) {
    g.fillStyle = accentOf(it.colors, it.golden);
    g.beginPath(); g.arc(90, y - 13, 13, 0, Math.PI * 2); g.fill();
    g.fillStyle = ink;
    const by = it.creator && it.category !== 'food' ? `, ${it.creator.split(',')[0] ?? ''}` : '';
    g.fillText(fit(g, `${it.title}${by}`, W - 200), 124, y);
    y += 62;
  }
  if (items.length > 4) {
    g.fillStyle = muted;
    g.fillText(`and ${String(items.length - 4)} more`, 124, y);
  }
}

function footer(g: CanvasRenderingContext2D, opts: { name: string; chain: number }, ink: string) {
  g.font = '700 30px "Inter Tight", Arial, sans-serif';
  g.fillStyle = ink;
  g.textAlign = 'left';
  g.fillText(`consumed.today/${opts.name.toLowerCase()}`, 72, H - 64);
  g.textAlign = 'right';
  g.fillText(`Day ${String(opts.chain)} of the chain`, W - 72, H - 64);
  g.textAlign = 'left';
}

const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the card.'))), 'image/png'));

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function fit(g: CanvasRenderingContext2D, text: string, max: number): string {
  if (g.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 3 && g.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}
