// The Consumed card: one 1080 by 1920 image of the day, sized for Instagram Stories and WhatsApp.
// With live calls, the middle is Muse Image's painting of the day; without, it is the day's own stickers.

import { loadImage, stickerSvg } from './stickers.js';
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

export async function renderCard(items: Sticker[], opts: { date: Date; name: string; chain: number; painting?: string }): Promise<Blob> {
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
  if (opts.painting) {
    const img = await loadImage(opts.painting);
    const k = Math.max(pw / img.width, ph / img.height);
    g.drawImage(img, px + (pw - img.width * k) / 2, py + (ph - img.height * k) / 2, img.width * k, img.height * k);
  } else {
    g.fillStyle = '#f4efdc';
    g.fillRect(px, py, pw, ph);
    await drawStickers(g, items, px, py, pw, ph);
  }
  g.restore();

  // The list
  g.font = '700 38px "Inter Tight", Arial, sans-serif';
  let y = 1580;
  for (const it of items.slice(0, 4)) {
    g.fillStyle = it.colors[0] === '#1b1716' ? it.colors[1] : it.colors[0];
    g.beginPath(); g.arc(90, y - 13, 13, 0, Math.PI * 2); g.fill();
    g.fillStyle = INK;
    const by = it.creator && it.category !== 'food' ? `, ${it.creator.split(',')[0] ?? ''}` : '';
    g.fillText(fit(g, `${it.title}${by}`, W - 200), 124, y);
    y += 62;
  }
  if (items.length > 4) {
    g.fillStyle = MUTED;
    g.fillText(`and ${String(items.length - 4)} more`, 124, y);
  }

  // Footer
  g.font = '700 30px "Inter Tight", Arial, sans-serif';
  g.fillStyle = INK;
  g.fillText(`consumed.today/${opts.name.toLowerCase()}`, 72, H - 64);
  g.textAlign = 'right';
  g.fillText(`Day ${String(opts.chain)} of the chain`, W - 72, H - 64);

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the card.'))), 'image/png'));
}

async function drawStickers(g: CanvasRenderingContext2D, items: Sticker[], x: number, y: number, w: number, h: number) {
  const list = items.slice(0, 7);
  const spots = [[0.3, 0.27], [0.72, 0.24], [0.5, 0.52], [0.24, 0.72], [0.74, 0.7], [0.5, 0.86], [0.82, 0.47]];
  for (const [i, it] of list.entries()) {
    const [svg, sw, sh] = stickerSvg({ shape: it.shape, colors: it.colors, title: it.title, creator: it.creator, photo: it.photo, golden: it.golden }, 2.1);
    const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    const [fx, fy] = spots[i]!;
    g.save();
    g.translate(x + fx! * w, y + fy! * h);
    g.rotate((it.r * Math.PI) / 180);
    g.shadowColor = 'rgba(60, 35, 10, .25)';
    g.shadowBlur = 28;
    g.shadowOffsetY = 14;
    g.drawImage(img, -sw / 2, -sh / 2, sw, sh);
    g.restore();
  }
}

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
