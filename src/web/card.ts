// The Consumed card: one 1080 by 1920 image of the day, sized for Instagram Stories and WhatsApp.
// The front is the day's own paintings; with live calls, the back is Muse Image's painting of the whole day.

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
 * Two faces. The front (the default): a cream poster in the realfood.gov manner, one big black title and your
 * day's paintings piled into an upside-down pyramid. The back: Muse Image's painting of the whole day.
 */
export async function renderCard(items: Sticker[], opts: { date: Date; name: string; chain: number; painting?: string }): Promise<Blob> {
  return opts.painting ? paintedCard(items, opts, opts.painting) : posterCard(items, opts);
}

/** How many items sit in each row of the pile, widest row first. */
const ROWS: Record<number, number[]> = { 1: [1], 2: [2], 3: [2, 1], 4: [2, 2], 5: [3, 2], 6: [3, 2, 1], 7: [3, 3, 1] };

async function posterCard(items: Sticker[], opts: { date: Date; name: string; chain: number }): Promise<Blob> {
  await document.fonts.ready;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = PAPER;
  g.fillRect(0, 0, W, H);

  g.textBaseline = 'alphabetic';
  g.fillStyle = INK;
  let size = 176;
  g.letterSpacing = '-8px';
  do g.font = `900 ${String(size)}px "Inter Tight", Arial, sans-serif`; while (g.measureText(`${opts.name}'s`).width > W - 140 && (size -= 8) > 80);
  g.fillText(`${opts.name}'s`, 66, 236);
  g.fillText('Day', 66, 394);
  g.letterSpacing = '0px';
  g.fillStyle = MUTED;
  g.font = '600 38px "Inter Tight", Arial, sans-serif';
  g.fillText(`${opts.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · ${summary(items)}`, 70, 470);

  // Two labels over rules, like the pyramid's food groups: what you heard and read, and what you ate.
  g.fillStyle = INK;
  g.fillRect(70, 532, 400, 4);
  g.fillRect(W - 470, 532, 400, 4);
  g.font = '800 40px "Inter Tight", Arial, sans-serif';
  g.fillText('Listened & Read', 70, 588);
  g.textAlign = 'right';
  g.fillText('Ate & Drank', W - 70, 588);
  g.textAlign = 'left';

  // The paintings, songs and books first, then food: an upside-down pyramid, each overlapping its neighbors a
  // little so the day reads as one pile.
  const order = [...items.filter((i) => i.category !== 'food'), ...items.filter((i) => i.category === 'food')];
  const shown = order.slice(0, 7);
  const rows = ROWS[shown.length] ?? [];
  // As big as the space between the labels (y 620) and the list (y 1530) allows.
  const widest = Math.max(1, ...rows);
  const box = Math.min(620, (960 / widest) * 1.14, 890 / (1 + (rows.length - 1) * 0.78));
  const top = 620 + (910 - box * (1 + (rows.length - 1) * 0.78)) / 2;
  let k = 0;
  for (const [r, count] of rows.entries()) {
    const y = top + box / 2 + r * box * 0.78;
    for (let j = 0; j < count; j++, k++) {
      const it = shown[k]!;
      const x = W / 2 + (j - (count - 1) / 2) * box * 0.86;
      const base = artFor(it);
      const art = { ...base, photo: await inline(base.photo) };
      const [, w0, h0] = stickerSvg(art, 1);
      const [svg, sw, sh] = stickerSvg(art, box / Math.max(w0, h0));
      const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      g.drawImage(img, x - sw / 2, y - sh / 2, sw, sh);
    }
  }

  list(g, items, INK, MUTED);
  footer(g, opts, INK);
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
