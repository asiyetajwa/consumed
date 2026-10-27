import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lift } from '../src/shared/lift.js';

const W = 120, H = 120;
const CREAM = [252, 249, 238], WHITE = [255, 255, 255], INK = [90, 80, 70];

/** A cream page with a white bowl inside a grey outline that has a 2 pixel gap, a darker shadow and a speck. */
function page(): Uint8Array {
  const px = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const x = i % W, y = (i / W) | 0;
    const d = Math.hypot(x - 60, y - 60);
    let c = CREAM;
    if (d < 30) c = WHITE;
    else if (d < 33 && !(y < 60 && Math.abs(x - 60) < 1.5)) c = INK;
    else if (y > 90 && y < 98 && x > 40 && x < 80) c = [226, 222, 211];
    if (x === 5 && y === 5) c = INK;
    px.set([...c, 255], i * 4);
  }
  return px;
}
const alphaAt = (px: Uint8Array, x: number, y: number) => px[(y * W + x) * 4 + 3]!;

test('lift clears the paper and keeps the object', () => {
  const px = page();
  const box = lift(px, W, H);
  assert.ok(box);
  assert.equal(alphaAt(px, 2, 60), 0, 'paper is clear');
  assert.equal(alphaAt(px, 60, 61), 255, 'the outlined object stays');
  assert.equal(alphaAt(px, 5, 5) < 255, true, 'a lone speck is dropped');
  assert.ok(box[0] > 20 && box[2] < 100, 'the crop hugs the object, not the speck');
});

test('the shadow keeps a soft alpha', () => {
  const px = page();
  lift(px, W, H);
  const a = alphaAt(px, 60, 94);
  assert.ok(a > 20 && a < 160, `shadow alpha ${String(a)}`);
});

test("SAM's mask keeps a white rim the paper flood would take", () => {
  const keep = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) keep[i] = Math.hypot((i % W) - 60, ((i / W) | 0) - 60) < 34 ? 1 : 0;
  const px = page();
  lift(px, W, H, keep);
  assert.equal(alphaAt(px, 60, 40), 255);
  assert.equal(alphaAt(px, 10, 60), 0);
});
