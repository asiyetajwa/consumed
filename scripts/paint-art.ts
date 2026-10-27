// Paints the demo catalog once with Muse Image, in the same hand-painted style the app uses for anything you log,
// so search results land as paintings straight away. Run after `npm run fetch-art`; about $0.01 per item.
//   Paintings of our own demo food photos go to demo-art/painted/ (committed); paintings of third-party covers and
//   dishes go to art/painted/ (not committed). Existing paintings are kept.
// Run: npm run paint-art   (needs META_API_KEY, CONSUMED_LIVE=1 and a budget in .env)

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOG, nounFor } from '../src/shared/catalog.js';
import { lift } from '../src/shared/lift.js';
import { liveReason, Meta } from '../src/server/meta.js';
import { SpendGuard } from '../src/server/spend.js';

const slug = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const key = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
const ff = (args: string[]) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args]);

const reason = liveReason();
if (reason) throw new Error(reason);
const meta = new Meta(process.env.META_API_KEY!.trim(), new SpendGuard(Number(process.env.CONSUMED_BUDGET_USD), join(process.cwd(), '.consumed-ledger.jsonl')));
const manifestPath = join('art', 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, { file: string; source: string; ratio?: number; painted?: boolean }>;
const only = process.argv.slice(2).map(key);
const tmp = join('art', '.paint-tmp');
mkdirSync(tmp, { recursive: true });

/** SAM 3.1's mask of the painted dish, one byte per pixel at `w` by `h`, or undefined if it found nothing. */
async function dishMask(jpg: string, noun: string, w: number, h: number): Promise<Uint8Array | undefined> {
  const cut = await meta.segment(`data:image/jpeg;base64,${readFileSync(jpg).toString('base64')}`, w, h, [0, 0, 1000, 1000], noun);
  if (!cut) return undefined;
  const maskFile = join(tmp, 'mask.png');
  writeFileSync(maskFile, Buffer.from(cut.mask.split(',', 2)[1] ?? '', 'base64'));
  const [x1, y1] = cut.bounds;
  const gray = execFileSync('ffmpeg', ['-v', 'error', '-i', maskFile, '-vf', `format=gray,pad=${String(w)}:${String(h)}:${String(x1)}:${String(y1)}:color=black`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 16 << 20 });
  const keep = new Uint8Array(w * h);
  for (let i = 0; i < keep.length; i++) keep[i] = gray[i]! > 127 ? 1 : 0;
  return keep;
}

for (const c of CATALOG) {
  const k = key(c.title);
  if (only.length && !only.includes(k)) continue;
  const entry = manifest[k];
  if (!entry) continue;
  const name = slug(c.title);
  const ours = existsSync(join('demo-art', `${name}.jpg`));
  const dir = ours ? join('demo-art', 'painted') : join('art', 'painted');
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `${name}.png`);
  const ratioFile = `${out}.ratio`;
  if (!existsSync(out) || !existsSync(ratioFile)) {
    // The input: the food cut out by SAM (art/<name>.png) or the photo or cover, on cream, 640 pixels at most.
    const cut = join('art', `${name}.png`);
    const src = c.category === 'food' && existsSync(cut) ? cut : ours ? join('demo-art', `${name}.jpg`) : join('art', `${name}.jpg`);
    const input = join(tmp, 'in.jpg');
    ff(['-f', 'lavfi', '-i', 'color=c=0xfcf9ee:s=760x760', '-i', src, '-filter_complex', "[1]scale='min(600,iw)':'min(600,ih)':force_original_aspect_ratio=decrease[s];[0][s]overlay=(W-w)/2:(H-h)/2", '-frames:v', '1', '-q:v', '3', input]);
    let painted;
    try {
      painted = await meta.paint(`data:image/jpeg;base64,${readFileSync(input).toString('base64')}`, { category: c.category, kind: c.kind, title: c.title, creator: c.creator, noun: nounFor(c.shape, c.title) });
    } catch (e) {
      // A refused cover (a content filter) keeps its real artwork.
      console.log('skipped', c.title, e instanceof Error ? e.message.slice(0, 120) : e);
      continue;
    }
    const raw = join(tmp, 'painting');
    writeFileSync(raw, Buffer.from(painted.image.split(',', 2)[1] ?? '', 'base64'));
    // Lift it off its cream at 720 pixels, then crop and save 420 pixels on the long side.
    const W = 720;
    const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', raw]).toString().trim().split(',').map(Number);
    const H = Math.round((W * probe[1]!) / probe[0]!);
    const px = new Uint8Array(execFileSync('ffmpeg', ['-v', 'error', '-i', raw, '-vf', `scale=${String(W)}:${String(H)}`, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], { maxBuffer: 64 << 20 }));
    // For food, SAM 3.1 finds the painted dish first, so a white bowl on cream paper keeps its rim.
    let keep: Uint8Array | undefined;
    if (c.category === 'food') {
      const jpg = join(tmp, 'painting.jpg');
      ff(['-i', raw, '-vf', `scale=${String(W)}:${String(H)}`, '-frames:v', '1', '-q:v', '3', jpg]);
      keep = await dishMask(jpg, nounFor(c.shape, c.title), W, H);
    }
    const box = lift(px, W, H, keep);
    if (!box) { console.log('blank  ', c.title); continue; }
    writeFileSync(raw, px);
    const [x1, y1, x2, y2] = box;
    ff(['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${String(W)}x${String(H)}`, '-i', raw, '-vf', `crop=${String(x2 - x1)}:${String(y2 - y1)}:${String(x1)}:${String(y1)},scale='if(gt(iw,ih),min(420,iw),-2)':'if(gt(iw,ih),-2,min(420,ih))'`, '-frames:v', '1', out]);
    writeFileSync(ratioFile, String((x2 - x1) / (y2 - y1)));
    console.log('painted', c.title);
  }
  manifest[k] = { file: `art/painted/${name}.png`, source: entry.source.replace(/^Demo photo made with Muse Image$/, 'a demo photo'), ratio: Number(readFileSync(ratioFile, 'utf8')), painted: true };
}
rmSync(tmp, { recursive: true, force: true });
writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
console.log('manifest updated');
