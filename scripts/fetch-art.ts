// Gathers artwork for the demo catalog so the app (and a static copy of it) shows real covers and dishes.
//   Third-party art (Apple, Open Library, TheMealDB) goes to art/, which is not committed.
//   Food that no public catalog has is pictured once with Muse Image into demo-art/, which is committed.
// Run: npm run fetch-art   (Muse Image needs META_API_KEY, CONSUMED_LIVE=1 and a budget in .env)

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOG } from '../src/shared/catalog.js';
import { findArt } from '../src/server/art.js';
import { liveReason, Meta } from '../src/server/meta.js';
import { SpendGuard } from '../src/server/spend.js';

const slug = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const key = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');

mkdirSync('art', { recursive: true });
mkdirSync('demo-art', { recursive: true });
const meta = liveReason() === null ? new Meta(process.env.META_API_KEY!.trim(), new SpendGuard(Number(process.env.CONSUMED_BUDGET_USD), join(process.cwd(), '.consumed-ledger.jsonl'))) : null;
const manifest: Record<string, { file: string; source: string }> = {};

function save(dataUrl: string, out: string) {
  const tmp = `${out}.src`;
  writeFileSync(tmp, Buffer.from(dataUrl.split(',', 2)[1] ?? '', 'base64'));
  // 480 px on the long side is plenty for a sticker and keeps the page light.
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-vf', "scale='if(gt(iw,ih),min(480,iw),-2)':'if(gt(iw,ih),-2,min(480,ih))'", '-q:v', '4', out]);
  execFileSync('rm', [tmp]);
}

for (const c of CATALOG) {
  const name = `${slug(c.title)}.jpg`;
  const demo = join('demo-art', name);
  if (existsSync(demo)) {
    manifest[key(c.title)] = { file: `art/${name}`, source: 'Demo photo made with Muse Image' };
    console.log('demo   ', c.title);
    continue;
  }
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
writeFileSync(join('art', 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(`${String(Object.keys(manifest).length)} of ${String(CATALOG.length)} items have artwork`);
