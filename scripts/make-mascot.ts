// Paints Nibs, the Consumed mascot, once with Muse Image: one base picture, then edits of that same picture for
// each expression so it stays the same character. SAM 3.1 cuts each one out. About $0.06 in all.
// Run: npx tsx --env-file=.env scripts/make-mascot.ts   (existing pictures are kept)

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { liveReason, Meta } from '../src/server/meta.js';
import { SpendGuard } from '../src/server/spend.js';

const reason = liveReason();
if (reason) throw new Error(reason);
const meta = new Meta(process.env.META_API_KEY!.trim(), new SpendGuard(Number(process.env.CONSUMED_BUDGET_USD), join(process.cwd(), '.consumed-ledger.jsonl')));
const DIR = 'src/web/mascot';
const RAW = join(DIR, 'raw');
execFileSync('mkdir', ['-p', RAW]);

const BASE = 'A cute mascot character for a playful daily diary app: a small, plump, round creature shaped like a dumpling, warm cream body with rosy orange cheeks, big shiny black eyes, a tiny happy smile, little stubby arms and feet, and a small mustard yellow headphone band on its head. Hand-painted gouache style, bold flat colors, soft brush texture, like a cheerful modern American food poster. Full body, standing, centered, with space around it, on a plain flat pale sky blue background. No text, no letters.';
const KEEP = 'Keep exactly the same character, colors, proportions, painting style and plain pale sky blue background.';
const POSES: Record<string, string> = {
  look: `The character now holds a small round magnifying glass up to one big eye, curious and leaning forward. ${KEEP}`,
  happy: `The character is now overjoyed: eyes closed in happy crescents, mouth open in a big smile, both little arms raised in the air. ${KEEP}`,
  love: `The character now has big glossy red heart-shaped eyes and is hugging itself, delighted, with two tiny pink hearts floating beside it. ${KEEP}`,
  wave: `The character is now waving hello with one little arm, winking one eye, smiling. ${KEEP}`,
  sleepy: `The character is now sleepy: eyes closed, a small yawn, wearing a tiny blue nightcap with a pom-pom, a small yellow crescent moon floating beside it. ${KEEP}`,
};

async function save(name: string, dataUrl: string) {
  const raw = join(RAW, `${name}.png`);
  writeFileSync(raw, Buffer.from(dataUrl.split(',', 2)[1] ?? '', 'base64'));
  const size = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', raw]).toString().trim().split(',').map(Number);
  const [W, H] = [size[0]!, size[1]!];
  const small = join(RAW, `${name}.sam.jpg`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-q:v', '3', small]);
  const jpg = `data:image/jpeg;base64,${readFileSync(small).toString('base64')}`;
  const cut = (await meta.segment(jpg, W, H, [0, 0, 1000, 1000], 'cartoon character')) ?? (await meta.segment(jpg, W, H, [0, 0, 1000, 1000], 'character'));
  if (!cut) throw new Error(`SAM found no character in ${name}`);
  const mask = join(RAW, `${name}.mask.png`);
  writeFileSync(mask, Buffer.from(cut.mask.split(',', 2)[1] ?? '', 'base64'));
  const [x1, y1, x2, y2] = cut.bounds;
  const pad = Math.round(Math.max(x2 - x1, y2 - y1) * 0.04);
  const cx = Math.max(0, x1 - pad), cy = Math.max(0, y1 - pad), cw = Math.min(W, x2 + pad) - cx, ch = Math.min(H, y2 + pad) - cy;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-i', mask, '-filter_complex',
    `[1:v]format=gray,pad=${String(W)}:${String(H)}:${String(x1)}:${String(y1)}:color=black,lut=c0='if(lt(val\\,128)\\,0\\,255)',erosion,erosion,erosion,gblur=sigma=0.8[m];[0:v]format=rgba[p];[p][m]alphamerge,crop=${String(cw)}:${String(ch)}:${String(cx)}:${String(cy)},scale='if(gt(iw,ih),320,-2)':'if(gt(iw,ih),-2,320)'`, join(DIR, `${name}.png`)]);
  console.log('made', name);
}

const basePath = join(RAW, 'idle.png');
let base: string;
if (existsSync(basePath)) {
  base = `data:image/png;base64,${readFileSync(basePath).toString('base64')}`;
  if (!existsSync(join(DIR, 'idle.png'))) await save('idle', base);
}
else {
  base = (await meta.generate(BASE, 'mascot')).image;
  await save('idle', base);
}
for (const [name, prompt] of Object.entries(POSES)) {
  if (existsSync(join(DIR, `${name}.png`))) continue;
  // A paid edit is kept, so a failed cut-out never pays for the picture twice.
  const raw = join(RAW, `${name}.png`);
  await save(name, existsSync(raw) ? `data:image/png;base64,${readFileSync(raw).toString('base64')}` : (await meta.edit(base, prompt, 'mascot')).image);
}
