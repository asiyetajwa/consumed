// Records the real app, live, as one day on one phone, for the Consumed film. Each scene is a segment of Chrome's
// screencast (frames arrive only when the screen changes), encoded to public/clips/<scene>.mp4 at a constant 60 fps.
// Every tap that makes a sound in the app is written to public/clips/marks.json, so the film can play the same
// sounds at the same moments (a browser recording has no audio).
//
//   node scripts/record.mjs     (the app must be running live on :8791 with a Meta Model API key)

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { chromium, devices } from 'playwright';

const URL = process.env.APP_URL ?? 'http://127.0.0.1:8791/';
const PHOTOS = process.env.PHOTOS ?? '../demo-photos';
const OUT = 'public/clips';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
// The whole phone screen (Playwright's preset leaves room for browser chrome; an installed web app has none).
const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
// A soft ripple where each tap lands, so the viewer can follow the finger.
await ctx.addInitScript(() => {
  addEventListener('pointerdown', (e) => {
    const d = document.createElement('div');
    d.style.cssText = `position:fixed;left:${e.clientX - 22}px;top:${e.clientY - 22}px;width:44px;height:44px;border-radius:50%;background:rgba(22,11,6,.18);border:2px solid rgba(22,11,6,.35);pointer-events:none;z-index:99999;transition:transform .45s ease-out,opacity .45s ease-out`;
    document.documentElement.appendChild(d);
    requestAnimationFrame(() => { d.style.transform = 'scale(1.6)'; d.style.opacity = '0'; });
    setTimeout(() => d.remove(), 500);
  }, true);
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const cdp = await ctx.newCDPSession(page);

let frames = [];
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  frames.push({ data, t: metadata.timestamp });
  await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => undefined);
});

const allMarks = {};
const wait = (ms) => page.waitForTimeout(ms);

/** Records one scene. `mark(sound, delaySeconds)` notes a sound at this moment (plus a delay). */
async function scene(name, run) {
  frames = [];
  const marks = [];
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 780, maxHeight: 1688 });
  await wait(250);
  const startWall = Date.now() / 1000;
  const mark = (sound, delay = 0, volume = 1) => marks.push({ sound, at: Date.now() / 1000 - startWall + delay, volume });
  await run(mark);
  await wait(400);
  await cdp.send('Page.stopScreencast');
  await wait(150);
  if (frames.length === 0) throw new Error(`No frames for ${name}`);
  const dir = `${OUT}/${name}-frames`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const lines = [];
  frames.forEach((f, i) => {
    const file = `${String(i).padStart(5, '0')}.jpg`;
    writeFileSync(`${dir}/${file}`, Buffer.from(f.data, 'base64'));
    const next = frames[i + 1]?.t ?? f.t + 0.4;
    lines.push(`file '${file}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
  });
  lines.push(`file '${String(frames.length - 1).padStart(5, '0')}.jpg'`);
  writeFileSync(`${dir}/list.txt`, `${lines.join('\n')}\n`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', `${dir}/list.txt`, '-vf', 'fps=60,scale=780:1688:flags=lanczos', '-c:v', 'libx264', '-crf', '15', '-pix_fmt', 'yuv420p', `${OUT}/${name}.mp4`]);
  rmSync(dir, { recursive: true, force: true });
  // Marks are counted from the clip's first frame.
  const offset = startWall - frames[0].t;
  allMarks[name] = marks.map((m) => ({ ...m, at: Math.max(0, m.at + offset) }));
  const seconds = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', `${OUT}/${name}.mp4`]).toString().trim());
  console.log(`${name}: ${seconds.toFixed(1)}s, ${String(frames.length)} frames, ${String(marks.length)} sounds`);
}

const visibleLog = () => page.locator('.view:not([data-pos]) .js-log');
// A sticker lands about 0.64 s after Stick It (sheet closes, then the drop): a pop, then its own sound.
const stickSounds = (mark, sound) => { mark('pop', 0.64); mark(sound, 0.71); };

await page.goto(URL);
await wait(1500);

await scene('welcome', async (mark) => {
  await wait(1200);
  await page.locator('#ob-name').click();
  await page.keyboard.type('Sam', { delay: 120 });
  await wait(300);
  mark('pop'); await page.keyboard.press('Enter'); await wait(1100);
  mark('pop'); mark('paper', 0.02, 0.6); await page.click('.ob-choices [data-v="Books"]'); await wait(1300);
  for (const v of ['2', '3']) { await page.fill('#ob-range', v); await page.dispatchEvent('#ob-range', 'input'); mark('pop', 0, 0.3); await wait(450); }
  mark('pop'); await page.click('#ob-next'); await wait(1100);
  mark('pop'); await page.click('#ob-next'); await wait(1000);
  mark('chime'); await page.click('#ob-finish'); await wait(4200);
  await page.click('#ob-go'); await wait(1200);
});

await scene('friends', async (mark) => {
  await wait(1400);
  const deck = page.locator('.deck-wrap').first();
  for (const sound of ['burp', 'chime', 'paper']) {
    mark('pop', 0, 0.35); mark(sound, 0.38, 0.7);
    await deck.click();
    await wait(1900);
  }
});

async function logBySearch(mark, cat, text, sound) {
  await visibleLog().click(); await wait(700);
  await page.click(`.seg [data-cat="${cat}"]`); await wait(400);
  await page.locator('#q').click();
  await page.keyboard.type(text, { delay: 75 });
  await wait(300);
  await page.click('#search button');
  await page.waitForSelector('#result:not([hidden])', { timeout: 60000 });
  mark('pop', 0, 0.35);
  await wait(2600);
  stickSounds(mark, sound);
  await page.click('#stick');
  await wait(2600);
}

await scene('song', (mark) => logBySearch(mark, 'audio', 'espresso sabrina', 'chime'));
await scene('book', (mark) => logBySearch(mark, 'book', 'tomorrow and tomorrow', 'paper'));

await scene('meal', async (mark) => {
  await visibleLog().click(); await wait(700);
  await page.click('.seg [data-cat="food"]'); await wait(500);
  await page.setInputFiles('#photo', `${PHOTOS}/pho.jpg`);
  await page.waitForSelector('#result:not([hidden])', { timeout: 90000 });
  mark('pop', 0, 0.35);
  await wait(2800);
  stickSounds(mark, 'chew');
  await page.click('#stick');
  await wait(2800);
});

await scene('dare', async (mark) => {
  await visibleLog().click(); await wait(700);
  await page.click('.seg [data-cat="food"]'); await wait(500);
  await page.click('#chips [data-q="Ube Latte"]');
  await page.waitForSelector('#result:not([hidden])', { timeout: 60000 });
  mark('pop', 0, 0.35);
  await wait(2200);
  stickSounds(mark, 'burp');
  await page.click('#stick');
  await wait(3800);
});

await scene('today', async (mark) => {
  await page.evaluate(() => document.getElementById('page').scrollTo({ top: 0, behavior: 'smooth' }));
  await wait(900);
  const art = await page.locator('.sticker .art').nth(1).boundingBox();
  await page.mouse.move(art.x + art.width / 2, art.y + art.height / 2);
  await page.mouse.down();
  await page.mouse.move(art.x - 40, art.y + 150, { steps: 24 });
  await page.mouse.up();
  mark('pop', 0, 0.45);
  await wait(1300);
  mark('paper', 0, 0.5);
  await page.click('#tidy');
  await wait(1800);
});

// Muse Image paints the card once, off camera; the reveal then uses the painting it saved.
await page.click('.pillnav [data-go="tonight"]'); await wait(600);
await page.click('#crack-btn');
await page.waitForSelector('.capsule-stage.open', { timeout: 120000 });
await page.reload(); await wait(1500);

await scene('tonight', async (mark) => {
  await page.click('.pillnav [data-go="tonight"]'); await wait(1600);
  mark('crack', 0.25);
  await page.click('#crack-btn');
  await wait(3200);
  for (let i = 0; i < 2; i++) {
    mark('pop', 0, 0.4);
    await page.click('#card');
    await wait(2300);
  }
});

await scene('share', async (mark) => {
  await wait(600);
  mark('pop', 0, 0.5);
  await page.click('#share-stories').catch(() => undefined);
  await wait(2600);
});

writeFileSync(`${OUT}/marks.json`, JSON.stringify(allMarks, null, 2));
console.log(errors.length ? `Page errors: ${errors.join(' | ')}` : 'No page errors');
await browser.close();
