// Gathers artwork for the demo catalog so the app (and a static copy of it) shows real covers and dishes.
//   Third-party art (Apple, Open Library, TheMealDB) goes to art/, which is not committed.
//   Food that no public catalog has is pictured once with Muse Image into demo-art/, which is committed.
// Run: npm run fetch-art   (Muse Image needs META_API_KEY, CONSUMED_LIVE=1 and a budget in .env)

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOG, nounFor } from '../src/shared/catalog.js';
import { findArt } from '../src/server/art.js';
import { liveReason, Meta } from '../src/server/meta.js';
import { SpendGuard } from '../src/server/spend.js';

const slug = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const key = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');

mkdirSync('art', { recursive: true });
mkdirSync('demo-art', { recursive: true });
const meta = liveReason() === null ? new Meta(process.env.META_API_KEY!.trim(), new SpendGuard(Number(process.env.CONSUMED_BUDGET_USD), join(process.cwd(), '.consumed-ledger.jsonl'))) : null;
const manifest: Record<string, { file: string; source: string; ratio?: number }> = {};

function save(dataUrl: string, out: string) {
  const tmp = `${out}.src`;
  writeFileSync(tmp, Buffer.from(dataUrl.split(',', 2)[1] ?? '', 'base64'));
  // 480 px on the long side is plenty for a sticker and keeps the page light.
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-vf', "scale='if(gt(iw,ih),min(480,iw),-2)':'if(gt(iw,ih),-2,min(480,ih))'", '-q:v', '4', out]);
  execFileSync('rm', [tmp]);
}

/** Cuts a food photo out along its outline with SAM 3.1, into art/<name>.png. Returns width over height. */
async function cutOut(jpg: string, out: string, nouns: string[]): Promise<number | null> {
  if (!meta) return null;
  const size = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', jpg]).toString().trim().split(',').map(Number);
  const [W, H] = [size[0]!, size[1]!];
  const image = `data:image/jpeg;base64,${readFileSync(jpg).toString('base64')}`;
  // The full name first ("glass of ube latte"), then the dish, then the plain object ("glass").
  let cut = null;
  for (const n of nouns) {
    cut = await meta.segment(image, W, H, [0, 0, 1000, 1000], n);
    if (cut) break;
  }
  if (!cut) return null;
  const maskFile = `${out}.mask.png`;
  writeFileSync(maskFile, Buffer.from(cut.mask.split(',', 2)[1] ?? '', 'base64'));
  const [x1, y1, x2, y2] = cut.bounds;
  const pad = Math.round(Math.max(x2 - x1, y2 - y1) * 0.05);
  const cx = Math.max(0, x1 - pad), cy = Math.max(0, y1 - pad);
  const cw = Math.min(W, x2 + pad) - cx, ch = Math.min(H, y2 + pad) - cy;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', jpg, '-i', maskFile, '-filter_complex',
    `[1:v]format=gray,pad=${String(W)}:${String(H)}:${String(x1)}:${String(y1)}:color=black,lut=c0='if(lt(val\\,128)\\,0\\,255)',gblur=sigma=0.7[m];[0:v]format=rgba[p];[p][m]alphamerge,crop=${String(cw)}:${String(ch)}:${String(cx)}:${String(cy)}`, out]);
  execFileSync('rm', [maskFile]);
  return cw / ch;
}

for (const c of CATALOG) {
  const name = `${slug(c.title)}.jpg`;
  const demo = join('demo-art', name);
  if (existsSync(demo)) {
    manifest[key(c.title)] = { file: `art/${name}`, source: 'Demo photo made with Muse Image' };
    console.log('demo   ', c.title);
  } else {
    const art = await findArt({ category: c.category, kind: c.kind, title: c.title, creator: c.creator });
    if (art) {
      save(art.image, join('art', name));
      manifest[key(c.title)] = { file: `art/${name}`, source: art.source };
      console.log('found  ', art.source.padEnd(15), c.title);
    } else if (c.category === 'food' && meta) {
      const pic = await meta.picture(c.visual);
      save(pic.image, demo);
      manifest[key(c.title)] = { file: `art/${name}`, source: 'Demo photo made with Muse Image' };
      console.log('pictured', c.title, `$${pic.costUsd.toFixed(2)}`);
    } else console.log('none   ', c.title);
  }
  // Food becomes a cut-out along its own outline.
  const entry = manifest[key(c.title)];
  if (c.category === 'food' && entry) {
    const png = `${slug(c.title)}.png`;
    const jpg = existsSync(demo) ? demo : join('art', name);
    const ratioFile = join('art', `${png}.ratio`);
    let ratio = existsSync(ratioFile) ? Number(readFileSync(ratioFile, 'utf8')) : null;
    if (!ratio) {
      const noun = nounFor(c.shape, c.title);
      ratio = await cutOut(jpg, join('art', png), [noun, c.title.toLowerCase(), noun.split(' of ')[0]!]);
      if (ratio) writeFileSync(ratioFile, String(ratio));
    }
    if (ratio) {
      manifest[key(c.title)] = { ...entry, file: `art/${png}`, ratio };
      console.log('cut out', c.title, ratio.toFixed(2));
    }
  }
}
writeFileSync(join('art', 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(`${String(Object.keys(manifest).length)} of ${String(CATALOG.length)} items have artwork`);
