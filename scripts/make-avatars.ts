// Paints the demo profile pictures once with Muse Image, in the app's poster style. The people are invented.
// Run: npx tsx --env-file=.env scripts/make-avatars.ts   (about $0.01 each; existing pictures are kept)

import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { liveReason, Meta } from '../src/server/meta.js';
import { SpendGuard } from '../src/server/spend.js';

const PEOPLE: Record<string, [string, string]> = {
  sam: ['a young adult with short curly dark brown hair, a warm smile and a mustard yellow knit sweater', 'warm sunflower yellow'],
  maya: ['a young woman with long wavy black hair, round tortoiseshell glasses and a soft pink top, reading glasses pushed up', 'blush pink'],
  leo: ['a young man with a buzz cut, light stubble and a faded blue denim jacket, grinning', 'pale sky blue'],
  jordan: ['a young Black woman with short natural curls, gold hoop earrings and an orange top, laughing', 'tangerine orange'],
  priya: ['a young South Asian woman with a long dark braid over one shoulder and a green cardigan, calm smile', 'soft sage green'],
};

const reason = liveReason();
if (reason) throw new Error(reason);
const meta = new Meta(process.env.META_API_KEY!.trim(), new SpendGuard(Number(process.env.CONSUMED_BUDGET_USD), join(process.cwd(), '.consumed-ledger.jsonl')));
for (const [id, [who, bg]] of Object.entries(PEOPLE)) {
  const out = join('src/web/avatars', `${id}.jpg`);
  if (existsSync(out)) continue;
  const pic = await meta.generate(`A friendly hand-painted gouache portrait of ${who}, head and shoulders, centered and filling the frame, bold flat colors with soft brush texture, a plain ${bg} background, in the style of a cheerful modern American food poster illustration. An invented person, not a real one. No text, no letters, no border.`, 'avatar');
  const tmp = `${out}.src`;
  writeFileSync(tmp, Buffer.from(pic.image.split(',', 2)[1] ?? '', 'base64'));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-vf', 'scale=192:192', '-q:v', '3', out]);
  execFileSync('rm', [tmp]);
  console.log('painted', id);
}
