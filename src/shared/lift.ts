// Lifts a Muse Image painting off its plain cream background, in place, so it can sit on any page. Pixels that
// join the border and are close to the background color become clear; the darker ones among them (the painting's
// soft contact shadow) keep a share of alpha as a warm grey. Everything the border cannot reach stays opaque.
// For food, SAM 3.1's mask of the painted dish is passed as `keep`, so a white bowl rim the same color as the
// paper is never taken for paper. Used by the browser and by the catalog script.

const TOLERANCE = 30;
const SHADOW = [60, 40, 20] as const;

/** `px` is RGBA, `w` by `h`. Returns the bounds of what is left visible: [x1, y1, x2, y2], or null if nothing. */
export function lift(px: Uint8ClampedArray | Uint8Array, w: number, h: number, keep?: Uint8Array): [number, number, number, number] | null {
  const n = w * h;
  // The background color: the median of the outermost pixels, per channel.
  const ring: number[][] = [[], [], []];
  const take = (i: number) => { for (let c = 0; c < 3; c++) ring[c]!.push(px[i * 4 + c]!); };
  for (let x = 0; x < w; x += 2) { take(x); take((h - 1) * w + x); }
  for (let y = 0; y < h; y += 2) { take(y * w); take(y * w + w - 1); }
  const bg = ring.map((v) => v.sort((a, b) => a - b)[v.length >> 1]!) as [number, number, number];
  const bgMean = (bg[0] + bg[1] + bg[2]) / 3;
  const near = (i: number) => Math.max(Math.abs(px[i * 4]! - bg[0]), Math.abs(px[i * 4 + 1]! - bg[1]), Math.abs(px[i * 4 + 2]! - bg[2])) < TOLERANCE;

  // Flood from the border through background-like pixels. A painted outline can have hairline gaps where a white
  // bowl meets the cream, so the flood runs on the background shrunk by a few pixels (gaps that narrow cannot
  // carry it), and then grows back to the full background it reached.
  const isNear = new Uint8Array(n);
  for (let i = 0; i < n; i++) isNear[i] = near(i) ? 1 : 0;
  const r = Math.max(2, Math.round(Math.max(w, h) * 0.006));
  const core = box(isNear, w, h, r, false);
  const out = new Uint8Array(n);
  const stack: number[] = [];
  const seed = (i: number) => { if (!out[i] && core[i]) { out[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    if (x > 0) seed(i - 1);
    if (x < w - 1) seed(i + 1);
    if (i >= w) seed(i - w);
    if (i < n - w) seed(i + w);
  }
  const grown = box(out, w, h, r, true);
  for (let i = 0; i < n; i++) out[i] = grown[i]! & isNear[i]! & (keep?.[i] ? 0 : 1);
  // With SAM's mask, anything clearly outside the dish is paper (or its shadow), even where the paper is uneven.
  if (keep) {
    const near = box(keep, w, h, r * 2, true);
    for (let i = 0; i < n; i++) if (!near[i]) out[i] = 1;
  }

  // Keep the object: specks of paper texture the flood could not reach are dropped, as is anything far smaller
  // than the largest piece.
  const label = new Int32Array(n).fill(-1);
  const sizes: number[] = [];
  for (let i = 0; i < n; i++) {
    if (out[i] || label[i] !== -1) continue;
    const id = sizes.length;
    let size = 0;
    label[i] = id;
    stack.push(i);
    while (stack.length) {
      const j = stack.pop()!;
      size++;
      const x = j % w;
      for (const k of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, j - w, j + w]) {
        if (k < 0 || k >= n || out[k] || label[k] !== -1) continue;
        label[k] = id;
        stack.push(k);
      }
    }
    sizes.push(size);
  }
  const biggest = sizes.reduce((m, v) => Math.max(m, v), 0);
  const speck = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (!out[i] && sizes[label[i]!]! < biggest * 0.04) { out[i] = 1; speck[i] = 1; }

  // Alpha: opaque inside, shadow-dark outside; then a light blur so the edge is not jagged.
  const alpha = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (!out[i]) { alpha[i] = 1; continue; }
    if (speck[i]) continue;
    const mean = (px[i * 4]! + px[i * 4 + 1]! + px[i * 4 + 2]!) / 3;
    // Paper grain sits a few levels under the background; only a real shadow, darker than that, shows.
    alpha[i] = Math.min(1, Math.max(0, (bgMean - mean - 14) / 50)) * 0.55;
  }
  const soft = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, k = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          s += alpha[yy * w + xx]!; k++;
        }
      }
      soft[y * w + x] = s / k;
    }
  }

  let x1 = w, y1 = h, x2 = -1, y2 = -1;
  for (let i = 0; i < n; i++) {
    if (out[i]) { px[i * 4] = SHADOW[0]; px[i * 4 + 1] = SHADOW[1]; px[i * 4 + 2] = SHADOW[2]; }
    const a = Math.round(soft[i]! * 255);
    px[i * 4 + 3] = a;
    if (a > 10) {
      const x = i % w, y = (i / w) | 0;
      if (x < x1) x1 = x;
      if (x > x2) x2 = x;
      if (y < y1) y1 = y;
      if (y > y2) y2 = y;
    }
  }
  return x2 < 0 ? null : [x1, y1, x2 + 1, y2 + 1];
}

/** Grows (`grow`) or shrinks a 0/1 mask by a square of radius `r`, as two passes of running counts. */
function box(src: Uint8Array, w: number, h: number, r: number, grow: boolean): Uint8Array {
  const pass = (input: Uint8Array, horizontal: boolean) => {
    const res = new Uint8Array(input.length);
    const [lines, len] = horizontal ? [h, w] : [w, h];
    for (let line = 0; line < lines; line++) {
      const at = (k: number) => (horizontal ? line * w + k : k * w + line);
      let count = 0;
      for (let k = 0; k < Math.min(r, len); k++) count += input[at(k)]!;
      for (let k = 0; k < len; k++) {
        if (k + r < len) count += input[at(k + r)]!;
        if (k - r - 1 >= 0) count -= input[at(k - r - 1)]!;
        const span = Math.min(len - 1, k + r) - Math.max(0, k - r) + 1;
        res[at(k)] = grow ? (count > 0 ? 1 : 0) : count === span ? 1 : 0;
      }
    }
    return res;
  };
  return pass(pass(src, true), false);
}
