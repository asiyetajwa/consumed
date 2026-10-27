// Sticker art. Every sticker is drawn here as SVG from the item's shape and three colors: a white die-cut edge,
// flat painted color, a soft inner shade and a glossy highlight. Books and records carry their title, so a
// sticker reads as the thing itself. Photo stickers are the photo, cut out round (or as a cover) with the same edge.

import type { Shape } from '../shared/types.js';

export interface Art {
  shape: Shape;
  colors: [string, string, string];
  title: string;
  creator: string;
  photo?: string;
  golden?: boolean;
  /** How a photo is framed: an album sleeve, a square tile, a book cover or a round cut. */
  frame?: Frame;
  /** Width over height of a cut-out. */
  ratio?: number;
}

export type Frame = 'sleeve' | 'square' | 'cover' | 'round' | 'cutout';

export function frameFor(category: string, kind: string): Frame {
  if (category === 'book') return 'cover';
  if (category === 'audio') return kind === 'audiobook' || kind === 'podcast' ? 'square' : 'sleeve';
  return 'round';
}

let uid = 0;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${String(c.charCodeAt(0))};`);

/** Light or dark text for a background color. */
function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#1b1716' : '#fcf9ec';
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Splits a title into at most `max` lines of about `width` characters. */
function lines(text: string, width: number, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > width && cur) {
      out.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur);
  if (out.length > max) {
    const keep = out.slice(0, max);
    keep[max - 1] = `${keep[max - 1]!.replace(/[.,]?$/, '')}…`;
    return keep;
  }
  return out;
}

const EDGE = '#ffffff';

/** Returns [svg, width, height]. */
export function stickerSvg(a: Art, size = 1): [string, number, number] {
  const id = `s${String(++uid)}`;
  const [c1, c2, c3] = a.colors;
  const gold = a.golden ? `<linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".35" stop-color="#e2b23a"/><stop offset=".6" stop-color="#fff0a0"/><stop offset="1" stop-color="#b8861c"/></linearGradient>` : '';
  const edge = a.golden ? `url(#${id}g)` : EDGE;
  const gloss = (d: string) => `<path d="${d}" stroke="#fff" stroke-opacity=".38" stroke-width="7" fill="none" stroke-linecap="round"/>`;
  let w = 150, h = 150, body = '';

  if (a.photo) {
    const frame = a.frame ?? (a.shape === 'book' ? 'cover' : 'round');
    const img = (x: number, y: number, iw: number, ih: number, clip: string) => `<clipPath id="${id}c">${clip}</clipPath><image href="${esc(a.photo!)}" x="${String(x)}" y="${String(y)}" width="${String(iw)}" height="${String(ih)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id}c)"/>`;
    if (frame === 'cutout') {
      // The item's own outline, with a white die-cut edge grown from its alpha.
      const r = a.ratio ?? 1;
      w = r >= 1 ? 156 : Math.round(156 * r);
      h = r >= 1 ? Math.round(156 / r) : 156;
      const pad = 6;
      const edgeColor = a.golden ? '#e2b23a' : '#ffffff';
      const defs = `${gold}<filter id="${id}e" x="-10%" y="-10%" width="120%" height="120%"><feMorphology in="SourceAlpha" operator="dilate" radius="4.5" result="d"/><feGaussianBlur in="d" stdDeviation=".5" result="s"/><feFlood flood-color="${edgeColor}"/><feComposite in2="s" operator="in" result="edge"/><feMerge><feMergeNode in="edge"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
      body = `<image href="${esc(a.photo)}" x="${String(pad)}" y="${String(pad)}" width="${String(w - pad * 2)}" height="${String(h - pad * 2)}" preserveAspectRatio="xMidYMid meet" filter="url(#${id}e)"/>`;
      return poster(id, defs, body, w, h, size, a);
    }
    if (frame === 'cover') {
      w = 118; h = 168;
      body = `<rect x="2" y="2" width="114" height="164" rx="12" fill="${edge}"/>
        ${img(9, 9, 100, 150, '<rect x="9" y="9" width="100" height="150" rx="4"/>')}
        <rect x="9" y="9" width="7" height="150" fill="#000" opacity=".12"/>
        <path d="M98 14 L104 14 L104 154 L98 154" fill="#fff" opacity=".16"/>`;
    } else if (frame === 'sleeve') {
      w = 186; h = 152;
      body = `<circle cx="120" cy="76" r="62" fill="${edge}"/>
        <circle cx="120" cy="76" r="56" fill="#141010"/>
        ${[48, 40, 32].map((r) => `<circle cx="120" cy="76" r="${String(r)}" fill="none" stroke="#2a2422" stroke-width="1.6"/>`).join('')}
        <circle cx="120" cy="76" r="17" fill="${c2}"/><circle cx="120" cy="76" r="3" fill="#141010"/>
        <rect x="2" y="2" width="148" height="148" rx="12" fill="${edge}"/>
        ${img(9, 9, 134, 134, '<rect x="9" y="9" width="134" height="134" rx="4"/>')}
        <path d="M18 40 L18 18 L40 18" stroke="#fff" stroke-opacity=".5" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    } else if (frame === 'square') {
      w = 156; h = 156;
      body = `<rect x="2" y="2" width="146" height="146" rx="20" fill="${edge}"/>
        ${img(9, 9, 132, 132, '<rect x="9" y="9" width="132" height="132" rx="12"/>')}
        <circle cx="132" cy="132" r="22" fill="${edge}"/><circle cx="132" cy="132" r="17" fill="${c1}"/>
        <path d="M123 136 v-4 a9 9 0 0 1 18 0 v4" stroke="${inkOn(c1)}" stroke-width="2.6" fill="none"/>
        <rect x="120" y="133" width="5" height="8" rx="2" fill="${inkOn(c1)}"/><rect x="139" y="133" width="5" height="8" rx="2" fill="${inkOn(c1)}"/>`;
    } else {
      w = 156; h = 156;
      body = `<circle cx="78" cy="78" r="77" fill="${edge}"/>
        ${img(9, 9, 138, 138, '<circle cx="78" cy="78" r="69"/>')}
        ${gloss('M30 52 A 54 54 0 0 1 72 20')}`;
    }
    return poster(id, gold, body, w, h, size, a);
  }

  switch (a.shape) {
    case 'vinyl': {
      const label = lines(a.title, 9, 2);
      body = `<circle cx="75" cy="75" r="73" fill="${edge}"/>
        <circle cx="75" cy="75" r="65" fill="${c1}"/>
        ${[57, 50, 43, 36].map((r) => `<circle cx="75" cy="75" r="${String(r)}" fill="none" stroke="${shade(c1, 0.07)}" stroke-width="1.6"/>`).join('')}
        <circle cx="75" cy="75" r="28" fill="${c2}"/>
        ${label.map((l, i) => `<text x="75" y="${String(66 + i * 9 + (label.length === 1 ? 4 : 0))}" text-anchor="middle" font-family="Inter Tight, Arial, sans-serif" font-weight="800" font-size="8" fill="${inkOn(c2)}">${esc(l)}</text>`).join('')}
        <circle cx="75" cy="84" r="3.4" fill="${c1}"/>
        ${gloss('M28 54 A 52 52 0 0 1 68 22')}`;
      break;
    }
    case 'cassette': {
      w = 170; h = 116;
      body = `<rect x="2" y="2" width="166" height="112" rx="16" fill="${edge}"/>
        <rect x="10" y="10" width="150" height="96" rx="10" fill="${c1}"/>
        <rect x="22" y="20" width="126" height="44" rx="6" fill="${c3}"/>
        <text x="85" y="36" text-anchor="middle" font-family="Inter Tight, Arial, sans-serif" font-weight="800" font-size="11" fill="#1b1716">${esc(lines(a.title, 18, 1)[0] ?? '')}</text>
        <rect x="30" y="42" width="110" height="16" rx="8" fill="${c2}"/>
        <circle cx="54" cy="50" r="6" fill="${c3}"/><circle cx="116" cy="50" r="6" fill="${c3}"/>
        <path d="M40 106 L52 78 H118 L130 106" fill="${shade(c1, -0.12)}"/>
        ${gloss('M20 24 L20 70')}`;
      break;
    }
    case 'headphones': {
      w = 150; h = 140;
      body = `<path d="M26 86 C 26 30, 124 30, 124 86" stroke="${edge}" stroke-width="26" fill="none" stroke-linecap="round"/>
        <path d="M26 86 C 26 30, 124 30, 124 86" stroke="${c1}" stroke-width="12" fill="none" stroke-linecap="round"/>
        <rect x="6" y="74" width="42" height="58" rx="17" fill="${edge}"/><rect x="102" y="74" width="42" height="58" rx="17" fill="${edge}"/>
        <rect x="12" y="80" width="30" height="46" rx="12" fill="${c1}"/><rect x="108" y="80" width="30" height="46" rx="12" fill="${c1}"/>
        <rect x="16" y="84" width="9" height="22" rx="4.5" fill="#fff" opacity=".35"/>`;
      break;
    }
    case 'audiobook': {
      w = 150; h = 170;
      const t = lines(a.title, 10, 3);
      body = `<rect x="16" y="26" width="118" height="142" rx="13" fill="${edge}"/>
        <rect x="24" y="34" width="102" height="126" rx="5" fill="${c1}"/>
        <rect x="24" y="34" width="11" height="126" fill="${shade(c1, -0.12)}"/>
        ${t.map((l, i) => `<text x="80" y="${String(86 + i * 15)}" text-anchor="middle" font-family="Inter Tight, Arial, sans-serif" font-weight="900" font-size="13" fill="${inkOn(c1)}">${esc(l)}</text>`).join('')}
        <path d="M30 60 C 30 6, 120 6, 120 60" stroke="${edge}" stroke-width="20" fill="none" stroke-linecap="round"/>
        <path d="M30 60 C 30 6, 120 6, 120 60" stroke="${c2}" stroke-width="9" fill="none" stroke-linecap="round"/>
        <rect x="14" y="48" width="32" height="42" rx="13" fill="${edge}"/><rect x="104" y="48" width="32" height="42" rx="13" fill="${edge}"/>
        <rect x="19" y="53" width="22" height="32" rx="9" fill="${c2}"/><rect x="109" y="53" width="22" height="32" rx="9" fill="${c2}"/>`;
      break;
    }
    case 'book': {
      w = 120; h = 162;
      const long = a.title.length > 24;
      const t = lines(a.title, long ? 11 : 9, long ? 5 : 4);
      const fs = long ? 11.5 : t.some((l) => l.length > 8) ? 13 : 15;
      const by = esc(lines(a.creator.split(',')[0] ?? '', 16, 1)[0] ?? '');
      body = `<rect x="2" y="2" width="116" height="158" rx="13" fill="${edge}"/>
        <rect x="10" y="10" width="100" height="142" rx="5" fill="${c1}"/>
        <rect x="10" y="10" width="12" height="142" rx="3" fill="${shade(c1, -0.13)}"/>
        <circle cx="66" cy="${String(54 - t.length * 4)}" r="14" fill="${c3}" opacity=".9"/>
        ${t.map((l, i) => `<text x="66" y="${String(78 + i * (fs + 2) - t.length * 4)}" text-anchor="middle" font-family="Inter Tight, Arial, sans-serif" font-weight="900" font-size="${String(fs)}" fill="${inkOn(c1)}" letter-spacing="-.3">${esc(l)}</text>`).join('')}
        <rect x="32" y="132" width="68" height="1.5" fill="${c2}" opacity=".7"/>
        <text x="66" y="145" text-anchor="middle" font-family="Inter Tight, Arial, sans-serif" font-weight="600" font-size="8" fill="${inkOn(c1)}" opacity=".85">${by}</text>
        <path d="M100 14 L106 14 L106 148 L100 148" fill="#fff" opacity=".17"/>`;
      break;
    }
    case 'pan': {
      w = 176; h = 136;
      body = `<ellipse cx="80" cy="70" rx="76" ry="62" fill="${edge}"/>
        <rect x="138" y="58" width="36" height="16" rx="8" fill="${edge}"/><rect x="141" y="61" width="30" height="10" rx="5" fill="#3a2a22"/>
        <ellipse cx="80" cy="70" rx="68" ry="54" fill="#3a2a22"/>
        <ellipse cx="80" cy="68" rx="60" ry="46" fill="${c1}"/>
        <ellipse cx="74" cy="62" rx="48" ry="33" fill="${shade(c1, 0.08)}" opacity=".7"/>
        ${[[56, 58], [100, 62], [76, 90]].map(([x, y]) => `<ellipse cx="${String(x)}" cy="${String(y)}" rx="17" ry="13" fill="${c2}"/><circle cx="${String(x! + 1)}" cy="${String(y)}" r="7" fill="${c3}"/>`).join('')}
        ${[[40, 82], [116, 84], [92, 40], [60, 38], [122, 52]].map(([x, y]) => `<path d="M${String(x)} ${String(y)} l5 -4 l3 6 z" fill="#3f8a2e"/>`).join('')}
        ${gloss('M30 50 A 62 48 0 0 1 72 24')}`;
      break;
    }
    case 'bowl': {
      w = 166; h = 140;
      body = `<path d="M6 58 H160 C 160 104, 126 136, 83 136 S 6 104, 6 58 Z" fill="${edge}"/>
        <ellipse cx="83" cy="58" rx="77" ry="30" fill="${edge}"/>
        <path d="M14 60 H152 C 150 100, 120 128, 83 128 S 16 100, 14 60 Z" fill="${c3 === '#fcf9ec' ? '#e9e2cf' : '#fcf9ec'}"/>
        <ellipse cx="83" cy="59" rx="69" ry="24" fill="${c1}"/>
        ${[[56, 54], [84, 50], [108, 58], [70, 66], [98, 68]].map(([x, y], i) => `<circle cx="${String(x)}" cy="${String(y)}" r="${String(i % 2 ? 7 : 9)}" fill="${i % 2 ? c3 : c2}"/>`).join('')}
        <path d="M24 74 C 34 104, 58 118, 82 120" stroke="#fff" stroke-opacity=".5" stroke-width="6" fill="none" stroke-linecap="round"/>`;
      break;
    }
    case 'plate': {
      w = 166; h = 166;
      body = `<circle cx="83" cy="83" r="81" fill="${edge}"/>
        <circle cx="83" cy="83" r="74" fill="#f6f1e2"/><circle cx="83" cy="83" r="58" fill="#fcf9ec" stroke="#e7dfc9" stroke-width="2"/>
        <ellipse cx="78" cy="86" rx="44" ry="30" fill="${c2}" transform="rotate(-18 78 86)"/>
        <ellipse cx="88" cy="76" rx="30" ry="20" fill="${c3}" opacity=".95" transform="rotate(-18 88 76)"/>
        ${[[64, 74], [96, 96], [72, 100], [104, 70]].map(([x, y]) => `<circle cx="${String(x)}" cy="${String(y)}" r="4" fill="${c1 === '#f4efdc' || c1 === '#fcf9ec' ? '#3f8a2e' : c1}"/>`).join('')}
        ${gloss('M30 56 A 60 60 0 0 1 70 24')}`;
      break;
    }
    case 'cup': {
      w = 120; h = 176;
      body = `<path d="M18 40 H102 L92 168 H28 Z" fill="${edge}" stroke="${edge}" stroke-width="10" stroke-linejoin="round"/>
        <rect x="70" y="2" width="12" height="60" rx="6" fill="${edge}" transform="rotate(14 76 32)"/>
        <rect x="73" y="4" width="6" height="56" rx="3" fill="${c3 === '#fcf9ec' ? '#e8432e' : c3}" transform="rotate(14 76 32)"/>
        <path d="M24 46 H96 L87 162 H33 Z" fill="${c2}" opacity=".95"/>
        <path d="M27 84 H93 L87 162 H33 Z" fill="${c1}"/>
        ${[[44, 66], [70, 72], [56, 92]].map(([x, y]) => `<rect x="${String(x)}" y="${String(y)}" width="15" height="13" rx="3" fill="#fff" opacity=".55"/>`).join('')}
        <path d="M34 54 L40 150" stroke="#fff" stroke-opacity=".45" stroke-width="5" stroke-linecap="round"/>`;
      break;
    }
    case 'mug': {
      w = 166; h = 140;
      body = `<rect x="10" y="22" width="114" height="112" rx="22" fill="${edge}"/>
        <path d="M118 46 h14 a24 24 0 0 1 0 52 h-14" stroke="${edge}" stroke-width="22" fill="none"/>
        <path d="M118 52 h12 a18 18 0 0 1 0 40 h-12" stroke="${c1}" stroke-width="10" fill="none"/>
        <rect x="18" y="30" width="98" height="96" rx="16" fill="${c1}"/>
        <ellipse cx="67" cy="38" rx="45" ry="11" fill="${c2}"/>
        <path d="M58 38 c 4 -6 14 -6 18 0 c -4 5 -14 5 -18 0" fill="#fcf9ec"/>
        <path d="M30 52 L30 112" stroke="#fff" stroke-opacity=".4" stroke-width="6" stroke-linecap="round"/>`;
      break;
    }
    case 'burger': {
      w = 166; h = 150;
      body = `<path d="M10 76 C 10 20, 156 20, 156 76 L 156 120 C 156 140, 10 140, 10 120 Z" fill="${edge}"/>
        <path d="M18 74 C 18 30, 148 30, 148 74 Z" fill="${c1}"/>
        ${[[50, 50], [80, 42], [108, 52], [66, 62], [96, 64]].map(([x, y]) => `<ellipse cx="${String(x)}" cy="${String(y)}" rx="4" ry="2.4" fill="#fcf2d6"/>`).join('')}
        <path d="M14 80 L152 80 L144 92 L128 84 L116 98 L100 86 L84 100 L66 86 L52 98 L38 84 L22 94 Z" fill="${c2}"/>
        <rect x="16" y="88" width="134" height="16" rx="8" fill="#5a2f1c"/>
        <path d="M16 104 Q 30 96 44 104 T 72 104 T 100 104 T 128 104 T 150 104" stroke="${c3}" stroke-width="7" fill="none" stroke-linecap="round"/>
        <rect x="18" y="108" width="130" height="22" rx="11" fill="${shade(c1, 0.04)}"/>
        ${gloss('M34 56 C 44 42, 62 36, 80 36')}`;
      break;
    }
    case 'pizza': {
      w = 156; h = 170;
      body = `<path d="M8 22 Q 78 -6 148 22 L 78 166 Z" fill="${edge}" stroke="${edge}" stroke-width="10" stroke-linejoin="round"/>
        <path d="M16 26 Q 78 2 140 26 L 78 152 Z" fill="${c1}"/>
        <path d="M16 26 Q 78 2 140 26 L 134 38 Q 78 16 22 38 Z" fill="${shade(c1, -0.18)}"/>
        ${[[56, 54], [96, 52], [76, 84], [62, 104], [92, 92], [78, 126]].map(([x, y]) => `<circle cx="${String(x)}" cy="${String(y)}" r="${String(y! > 110 ? 7 : 10)}" fill="${c2}"/><circle cx="${String(x! - 2)}" cy="${String(y! - 2)}" r="2.5" fill="#fff" opacity=".35"/>`).join('')}`;
      break;
    }
    case 'fruit': {
      w = 132; h = 150;
      const pts: [number, number][] = [[38, 40], [64, 36], [90, 42], [50, 62], [78, 62], [30, 68], [64, 86], [90, 82], [44, 92], [56, 116], [78, 108]];
      body = `${pts.map(([x, y]) => `<circle cx="${String(x)}" cy="${String(y + 10)}" r="20" fill="${edge}"/>`).join('')}
        ${pts.map(([x, y]) => `<circle cx="${String(x)}" cy="${String(y + 10)}" r="15" fill="${c1}"/><circle cx="${String(x - 5)}" cy="${String(y + 5)}" r="4.5" fill="#fff" opacity=".35"/>`).join('')}
        <path d="M64 26 L72 6" stroke="${edge}" stroke-width="12" stroke-linecap="round"/><path d="M64 26 L72 6" stroke="${c2}" stroke-width="5" stroke-linecap="round"/>
        <path d="M70 14 c 10 -10 26 -8 32 -2 c -12 4 -22 6 -32 2" fill="${c2}"/>`;
      break;
    }
    case 'donut': {
      w = 156; h = 156;
      body = `<circle cx="78" cy="78" r="76" fill="${edge}"/>
        <circle cx="78" cy="78" r="68" fill="${c2}"/>
        <path d="M78 18 C 112 16 140 40 138 76 C 140 92 128 96 126 108 C 116 132 96 140 78 138 C 52 140 24 124 20 98 C 14 84 26 78 20 64 C 22 38 50 18 78 18 Z" fill="${c1}"/>
        <circle cx="78" cy="78" r="20" fill="${edge}"/><circle cx="78" cy="78" r="15" fill="#efe9d6"/>
        ${Array.from({ length: 16 }, (_, i) => { const ang = i * 2.4, r = 30 + (i % 3) * 9; return `<rect x="${String(78 + Math.cos(ang) * r - 5)}" y="${String(78 + Math.sin(ang) * r - 1.5)}" width="10" height="3.6" rx="1.8" fill="${['#3c6fd8', '#f6b52a', '#fcf9ec', '#2f6b2a'][i % 4]!}" transform="rotate(${String(i * 37)} ${String(78 + Math.cos(ang) * r)} ${String(78 + Math.sin(ang) * r)})"/>`; }).join('')}
        ${gloss('M32 54 A 50 50 0 0 1 66 26')}`;
      break;
    }
  }
  return poster(id, gold, body, w, h, size, a);
}

// The Pop Poster look: around the sticker's white edge, a thick ring in the item's own color, then a hard ink
// shadow offset down and to the right, like a screen print. Done once here, so photos, covers, cut-outs and
// drawn stickers all get it.
const RING = 6;
const DROP = 5;
const PAD = RING + DROP + 2;

/** The boldest of the item's colors, for the ring: not near-black, not near-white. */
export function accentOf(colors: readonly string[], golden = false): string {
  if (golden) return '#e2b23a';
  let best = '#f6b52a';
  let score = -1;
  for (const c of colors) {
    const n = parseInt(c.slice(1), 16);
    const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const light = (max + min) / 2;
    if (light < 0.18 || light > 0.9) continue;
    const sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * light - 1));
    if (sat > score) { score = sat; best = c; }
  }
  return score < 0.2 ? '#f6b52a' : best;
}

function poster(id: string, defs: string, body: string, w: number, h: number, size: number, a: Art): [string, number, number] {
  const W = w + PAD * 2, H = h + PAD * 2;
  const ring = `<filter id="${id}p" x="-20%" y="-20%" width="140%" height="140%">
    <feMorphology in="SourceAlpha" operator="dilate" radius="${String(RING)}" result="d"/>
    <feFlood flood-color="${accentOf(a.colors, a.golden)}"/><feComposite in2="d" operator="in" result="ring"/>
    <feOffset in="d" dx="${String(DROP)}" dy="${String(DROP)}" result="o"/><feFlood flood-color="#160b06"/><feComposite in2="o" operator="in" result="ink"/>
    <feMerge><feMergeNode in="ink"/><feMergeNode in="ring"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  return [wrap(id, defs + ring, `<g transform="translate(${String(PAD)} ${String(PAD)})" filter="url(#${id}p)">${body}</g>`, W, H, size), W * size, H * size];
}

function wrap(id: string, defs: string, body: string, w: number, h: number, size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(w)} ${String(h)}" width="${String(w * size)}" height="${String(h * size)}" aria-hidden="true"><defs>${defs}</defs>${body}</svg>`;
}

/** Crops a photo to the model's box (0 to 1000 grid) with a little air, as a small JPEG for a sticker. */
export async function cropPhoto(dataUrl: string, box: [number, number, number, number], square: boolean): Promise<string> {
  const img = await loadImage(dataUrl);
  let [x1, y1, x2, y2] = box.map((v) => v / 1000) as [number, number, number, number];
  if (x2 - x1 < 0.05 || y2 - y1 < 0.05) [x1, y1, x2, y2] = [0, 0, 1, 1];
  const pad = 0.06;
  let sx = Math.max(0, x1 - pad) * img.width, sy = Math.max(0, y1 - pad) * img.height;
  let sw = (Math.min(1, x2 + pad) - Math.max(0, x1 - pad)) * img.width, sh = (Math.min(1, y2 + pad) - Math.max(0, y1 - pad)) * img.height;
  if (square) {
    const side = Math.min(Math.max(sw, sh), img.width, img.height);
    sx = Math.max(0, Math.min(img.width - side, sx + sw / 2 - side / 2));
    sy = Math.max(0, Math.min(img.height - side, sy + sh / 2 - side / 2));
    sw = sh = side;
  }
  const outW = square ? 320 : 240, outH = square ? 320 : Math.round(240 * (sh / sw));
  const c = document.createElement('canvas');
  c.width = outW; c.height = outH;
  c.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
  return c.toDataURL('image/jpeg', 0.84);
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = src;
  });
}

/** Downsizes a camera photo before it leaves the phone: faster, and fewer tokens. */
export async function downsize(file: File, max = 768): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}
