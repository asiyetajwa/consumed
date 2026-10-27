// Consumed: the app. Three pages (Today, Friends, Tonight) and the log sheet.

import { searchCatalog } from '../shared/catalog.js';
import type { Category, IdentifyResponse, Identified, Status } from '../shared/types.js';
import { renderCard, summary } from './card.js';
import { confetti } from './confetti.js';
import { alsoHas, FRIENDS, matches, matchLine, REACTIONS } from './friends.js';
import { isMuted, play, setMuted, soundFor, unlock } from './sound.js';
import { artFor, catalogArt, fetchArt, loadManifest } from './artwork.js';
import { makeCutout, requestCutout } from './cutout.js';
import { requestPaint } from './paint.js';
import { runOnboarding } from './onboarding.js';
import { deckHtml, flip } from './deck.js';
import { cropPhoto, downsize, stickerSvg } from './stickers.js';
import { dayKey, load, loggedDays, save, startFresh, type State, type Sticker } from './store.js';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const app = $('app');
let state: State = load();
let status: Status | null = null;
// Friends comes first: the app opens on what your friends consumed today.
const VIEWS = ['friends', 'today', 'tonight'] as const;
type View = (typeof VIEWS)[number];
let view: View = 'friends';

const today = () => (state.days[dayKey()] ??= []);
const persist = () => save(state);

document.addEventListener('pointerdown', unlock, { capture: true });

// ---------- navigation ----------
function go(next: View, push = true) {
  view = next;
  app.dataset.view = next;
  const i = VIEWS.indexOf(next);
  for (const [j, v] of VIEWS.entries()) {
    const el = $(`v-${v}`);
    if (j === i) el.removeAttribute('data-pos');
    else el.dataset.pos = j < i ? 'left' : 'right';
    el.inert = j !== i;
  }
  document.querySelectorAll<HTMLButtonElement>('.pillnav button').forEach((b) => b.toggleAttribute('aria-current', b.dataset.go === next));
  document.querySelectorAll<HTMLButtonElement>('.pillnav button[aria-current]').forEach((b) => b.setAttribute('aria-current', 'page'));
  const tc = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (tc) tc.content = next === 'tonight' ? '#140b06' : '#fcf9ec';
  if (next === 'friends') renderFriends();
  if (next === 'tonight') renderTonight();
  if (push) history.replaceState(null, '', `#${next}`);
}
document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-go]');
  if (b) go(b.dataset.go as View);
});

// Swipe between pages on empty space.
{
  let sx = 0, sy = 0, tracking = false;
  $('views').addEventListener('pointerdown', (e) => {
    tracking = !(e.target as HTMLElement).closest('.sticker, button, input, .feed .friend, .reacts');
    sx = e.clientX; sy = e.clientY;
  });
  $('views').addEventListener('pointerup', (e) => {
    if (!tracking) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) {
      const i = VIEWS.indexOf(view) + (dx < 0 ? 1 : -1);
      if (i >= 0 && i < VIEWS.length) go(VIEWS[i]!);
    }
  });
}

/** A profile picture: the painted demo portraits live in avatars/. */
const avatar = (id: string, name: string) => `<img class="av" src="avatars/${id}.jpg" alt="${name}" width="44" height="44">`;

// ---------- today ----------
// Today is an illustrated page: paintings sit straight in a two-column grid, all the same size, each with a
// two-line caption. Drag one and it comes loose to sit anywhere; Tidy Up puts everything back.
const board = $('board');
const page = $('page');
const COLS = 2;
const CELL_H = 204;
const ART = 128;

function captionLines(s: Sticker): [string, string] {
  if (s.category === 'food') {
    const d = new Date(s.at);
    const h = d.getHours();
    const meal = s.kind === 'drink' ? 'Drink' : s.kind === 'snack' || s.kind === 'dessert' ? 'Snack' : h < 11 ? 'Breakfast' : h < 16 ? 'Lunch' : h < 21 ? 'Dinner' : 'Late';
    return [s.title, `${meal} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`];
  }
  const by = (s.creator.split(/,| read by /)[0] ?? '').trim();
  if (s.golden) return [s.title, `Finished · ${by}`];
  return [s.title, by || (s.category === 'book' ? 'Book' : 'Listening')];
}

/** The sticker drawn to fit a square of `box` pixels, whatever its shape. */
function fitted(s: Parameters<typeof artFor>[0], box: number): string {
  const art = artFor(s);
  const [, w, h] = stickerSvg(art, 1);
  return stickerSvg(art, box / Math.max(w, h))[0];
}

function stickerEl(s: Sticker): HTMLElement {
  const el = document.createElement('div');
  el.className = `sticker${s.golden ? ' golden' : ''}`;
  el.dataset.id = s.id;
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', `${s.title}${s.creator ? `, ${s.creator}` : ''}. Open`);
  const [t, sub] = captionLines(s);
  el.innerHTML = `<div class="fx"><div class="art"><div class="rot">${fitted(s, ART)}</div></div><div class="cap"><b></b><span></span></div></div>`;
  el.querySelector('.cap b')!.textContent = t;
  el.querySelector('.cap span')!.textContent = sub;
  wire(el, s);
  return el;
}

/** Where a tidy sticker sits: the centre of its art, in pixels on the sheet. */
function slot(i: number): [number, number, number] {
  const w = board.clientWidth || 360;
  const col = i % COLS, row = Math.floor(i / COLS);
  return [(w / COLS) * (col + 0.5), row * CELL_H + 14 + ART / 2, 0];
}

function place(el: HTMLElement, s: Sticker) {
  const i = today().indexOf(s);
  let x: number, y: number, r: number;
  if (s.free) {
    x = (s.x / 100) * (board.clientWidth || 360);
    y = s.y;
    r = s.r;
  } else {
    [x, y, r] = slot(i);
  }
  el.style.left = `${String(x)}px`;
  el.style.top = `${String(y - ART / 2)}px`;
  el.style.zIndex = String(s.free ? 100 + s.z : s.z);
  el.style.setProperty('--r', String(r));
  el.style.setProperty('--s', String(s.free ? s.s : 1));
}

function layout() {
  const items = today();
  const rows = Math.ceil(Math.max(items.length + 1, 4) / COLS);
  const freeBottom = Math.max(0, ...items.filter((s) => s.free).map((s) => s.y + ART));
  board.style.height = `${String(Math.max(rows * CELL_H, freeBottom) + 8)}px`;
  for (const el of board.querySelectorAll<HTMLElement>('.sticker')) {
    const s = items.find((x) => x.id === el.dataset.id);
    if (s) place(el, s);
  }
  // Empty slots show where the next stickers go, and open the log for what is missing today.
  board.querySelectorAll('.slot').forEach((e) => e.remove());
  const missing: Category[] = (['audio', 'book', 'food'] as Category[]).filter((c) => !items.some((s) => s.category === c));
  const LABEL: Record<Category, string> = { audio: 'A Song', book: 'A Book', food: 'A Bite' };
  for (let i = items.length; i < rows * COLS; i++) {
    const [x, y] = slot(i);
    const c = missing[i - items.length] ?? 'food';
    const b = document.createElement('button');
    b.className = 'slot';
    b.style.left = `${String(x)}px`;
    b.style.top = `${String(y - ART / 2)}px`;
    b.innerHTML = `<span class="plus">+</span><span>${i - items.length < missing.length ? LABEL[c] : 'Log More'}</span>`;
    b.setAttribute('aria-label', `Log ${LABEL[c].toLowerCase()}`);
    b.onclick = () => openLog(c);
    board.appendChild(b);
  }
  $('tidy').hidden = !items.some((s) => s.free);
}

function renderToday() {
  const d = new Date();
  $('today-date').textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  board.replaceChildren(...today().map(stickerEl));
  layout();
  renderTally();
  renderDare();
  renderChain(false);
}

function renderTally() {
  const items = today();
  const n = (c: Category) => items.filter((s) => s.category === c).length;
  const before = $('tally').dataset.counts ?? '';
  const now = (['audio', 'book', 'food'] as Category[]).map((c) => String(n(c))).join(',');
  $('tally').innerHTML = (['audio', 'book', 'food'] as Category[]).map((c, i) => `<span class="t-${c}${before && before.split(',')[i] !== now.split(',')[i] ? ' bump' : ''}"><i></i>${{ audio: 'Listened', book: 'Read', food: 'Ate' }[c]} <b>${String(n(c))}</b></span>`).join('');
  $('tally').dataset.counts = now;
}

function renderChain(grow: boolean) {
  const days = loggedDays(state);
  const shown = Math.min(days, 6);
  const colors = ['#f6b52a', '#e8432e', '#2f6b2a', '#3c6fd8', '#6b2d5c'];
  const links = Array.from({ length: shown }, (_, i) => `<rect class="${grow && i === shown - 1 ? 'new' : ''}" x="${String(2 + i * 11)}" y="${i % 2 ? 7 : 4}" width="16" height="${i % 2 ? 10 : 16}" rx="5" fill="none" stroke="${colors[i % colors.length]!}" stroke-width="3.2"/>`).join('');
  $('chain').innerHTML = `<svg width="${String(shown * 11 + 8)}" height="24" viewBox="0 0 ${String(shown * 11 + 8)} 24" aria-hidden="true">${links}</svg><div><b>${days ? `Day ${String(days)}` : 'Day 1'}</b><span>${days ? 'Your chain, no pressure' : 'Your chain starts today'}</span></div>`;
}

const PURPLE = /purple|violet|lavender|plum|ube|grape|acai|açaí|blackberr|eggplant/i;
function renderDare() {
  const leo = FRIENDS.find((f) => f.dare)!;
  const done = today().some((s) => s.category === 'food' && (PURPLE.test(s.colorName) || PURPLE.test(s.title)));
  const el = $('dare');
  el.classList.toggle('done', done);
  el.innerHTML = `${done ? '<span class="mark">✓</span>' : avatar(leo.id, leo.name)}<div><b>${done ? 'Dare done' : `${leo.name}’s dare`}</b><span>${done ? `${leo.name} gets a ping` : 'Something purple today'}</span></div>`;
  if (done && !state.dareDone[dayKey()]) {
    state.dareDone[dayKey()] = true;
    persist();
    const r = el.getBoundingClientRect();
    setTimeout(() => confetti(r.left + r.width / 2, r.top, 60, 0.6), 700);
    setTimeout(() => toast(`Dare done. ${leo.name} gets a ping.`, undefined, leo.id), 900);
  }
}

$('tidy').addEventListener('click', () => {
  for (const s of today()) s.free = false;
  persist();
  board.classList.add('tidying');
  layout();
  play('paper', { volume: 0.5, rate: 1.2 });
  setTimeout(() => board.classList.remove('tidying'), 600);
});
window.addEventListener('resize', () => layout());

// Dragging, twisting and tapping.
function wire(el: HTMLElement, s: Sticker) {
  const pts = new Map<number, { x: number; y: number }>();
  let start = { x: 0, y: 0, sx: 0, sy: 0, r: 0, s: 1, ang: 0, dist: 0 };
  let moved = false, lastX = 0, tiltT = 0;
  const two = () => [...pts.values()] as [{ x: number; y: number }, { x: number; y: number }];

  el.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    el.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    s.z = Math.max(0, ...today().map((t) => t.z)) + 1;
    el.style.zIndex = String(s.z);
    moved = false;
    lastX = e.clientX;
    start = { x: e.clientX, y: e.clientY, sx: s.x, sy: s.y, r: s.r, s: s.s, ang: 0, dist: 0 };
    if (pts.size === 2) {
      const [a, b] = two();
      start.ang = Math.atan2(b.y - a.y, b.x - a.x);
      start.dist = Math.hypot(b.x - a.x, b.y - a.y);
      el.classList.add('twisting');
    }
  });
  el.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!s.free && (pts.size >= 2 || Math.hypot(e.clientX - start.x, e.clientY - start.y) >= 6)) {
      // Comes loose from its slot, from exactly where it sits.
      const [x, y, r] = slot(today().indexOf(s));
      s.free = true;
      s.x = (x / board.clientWidth) * 100;
      s.y = y;
      s.r = r;
      s.s = 1;
      start.sx = s.x; start.sy = s.y; start.r = s.r; start.s = 1;
      $('tidy').hidden = false;
    }
    if (pts.size >= 2) {
      const [a, b] = two();
      s.r = start.r + ((Math.atan2(b.y - a.y, b.x - a.x) - start.ang) * 180) / Math.PI;
      s.s = Math.max(0.6, Math.min(1.7, (start.s * Math.hypot(b.x - a.x, b.y - a.y)) / (start.dist || 1)));
      moved = true;
      place(el, s);
      return;
    }
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (!moved && Math.hypot(dx, dy) < 6) return;
    if (!moved) { moved = true; el.classList.add('lifted'); }
    s.x = Math.max(8, Math.min(92, start.sx + (dx / board.clientWidth) * 100));
    s.y = Math.max(ART / 2, Math.min(board.clientHeight + 120, start.sy + dy));
    // A little swing in the direction of travel, like holding a real sticker by its corner.
    const v = e.clientX - lastX;
    lastX = e.clientX;
    tiltT = Math.max(-9, Math.min(9, tiltT * 0.7 + v * 0.6));
    el.style.setProperty('--tilt', tiltT.toFixed(1));
    place(el, s);
  });
  const end = (e: PointerEvent) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size > 0) return;
    el.classList.remove('lifted', 'twisting');
    el.style.setProperty('--tilt', '0');
    if (!moved) {
      openDetail(s);
      return;
    }
    const fx = el.querySelector('.fx')!;
    fx.classList.remove('wobble');
    void (fx as HTMLElement).offsetWidth;
    fx.classList.add('wobble');
    play('pop', { volume: 0.45, rate: 1.15 });
    persist();
    layout();
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (!s.free) {
      const [x, y, r] = slot(today().indexOf(s));
      Object.assign(s, { free: true, x: (x / board.clientWidth) * 100, y, r, s: 1 });
      $('tidy').hidden = false;
    }
    if (e.shiftKey || e.ctrlKey) s.s = Math.max(0.6, Math.min(1.7, s.s - e.deltaY * 0.002));
    else s.r += e.deltaY * 0.15;
    place(el, s);
    persist();
  }, { passive: false });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(s); return; }
    const step = e.shiftKey ? 5 : 2;
    if (!s.free && /^(Arrow|\[|\])/.test(e.key)) {
      const [x, y, r] = slot(today().indexOf(s));
      Object.assign(s, { free: true, x: (x / board.clientWidth) * 100, y, r, s: 1 });
    }
    const moves: Record<string, () => void> = {
      ArrowLeft: () => (s.x = Math.max(8, s.x - step)), ArrowRight: () => (s.x = Math.min(92, s.x + step)),
      ArrowUp: () => (s.y = Math.max(ART / 2, s.y - step * 4)), ArrowDown: () => (s.y += step * 4),
      '[': () => (s.r -= 8), ']': () => (s.r += 8),
    };
    const m = moves[e.key];
    if (m) { e.preventDefault(); m(); place(el, s); persist(); layout(); }
  });
}

/** A new sticker drops onto today with a wobble, its pop and its own sound. */
function stick(item: Identified, extra: Partial<Sticker>) {
  if (view !== 'today') go('today');
  const firstToday = today().length === 0;
  const s: Sticker = { ...item, id: `${String(Date.now())}-${String(Math.random()).slice(2, 6)}`, at: new Date().toISOString(), x: 50, y: 0, r: 0, s: 1, z: Math.max(0, ...today().map((t) => t.z)) + 1, source: 'search', ...extra };
  today().push(s);
  persist();
  const el = stickerEl(s);
  el.querySelector('.fx')!.classList.add('drop');
  board.appendChild(el);
  layout();
  renderTally();
  // Bring its slot into view before it lands.
  const [, y] = slot(today().length - 1);
  page.scrollTo({ top: Math.max(0, y - page.clientHeight / 2), behavior: 'smooth' });
  // The landing frame of the drop animation is about 520 ms in.
  setTimeout(() => {
    play('pop');
    play(soundFor(s.category, s.kind), { delay: 0.07 });
    if (s.golden) {
      const r = el.getBoundingClientRect();
      confetti(r.left + r.width / 2, r.top + r.height / 2, 90, 1.2);
    }
  }, 520);
  setTimeout(() => {
    renderDare();
    if (firstToday) renderChain(true);
    const m = matches(state).find((mm) => mm.mine.id === s.id);
    if (m) toast(`${m.friend.name} has this too`, () => go('friends'), m.friend.id);
  }, 1000);
}

// ---------- sticker detail ----------
let detailFor: Sticker | null = null;
function openDetail(s: Sticker) {
  detailFor = s;
  const [svg] = stickerSvg(artFor(s), 1.05);
  $('d-art').innerHTML = svg;
  $('d-title').textContent = s.title;
  $('d-meta').textContent = [s.creator, s.detail].filter(Boolean).join(' · ');
  const credit = s.artSource ?? (s.photo ? undefined : catalogArt(s.title)?.source);
  $('d-credit').textContent = s.source === 'photo' ? 'Your photo' : credit ? `Art: ${credit}` : '';
  $('d-note').textContent = s.note;
  $('d-note').hidden = !s.note;
  $('d-friends').innerHTML = FRIENDS.map((f) => `<button data-flick="${f.id}" class="${state.flicked.some((x) => x.to === f.id && x.title === s.title) ? 'sent' : ''}">${avatar(f.id, f.name)}${f.name}</button>`).join('');
  $('d-remove').textContent = 'Remove';
  $('detail').hidden = false;
}
const closeDetail = () => { $('detail').hidden = true; detailFor = null; };
$('detail').addEventListener('click', (e) => { if (e.target === $('detail')) closeDetail(); });
$('d-done').addEventListener('click', closeDetail);
$('d-friends').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-flick]');
  if (!b || !detailFor) return;
  const f = FRIENDS.find((x) => x.id === b.dataset.flick)!;
  state.flicked.push({ to: f.id, title: detailFor.title, at: new Date().toISOString() });
  persist();
  b.classList.add('sent');
  play('pop', { rate: 1.3, volume: 0.7 });
  const el = board.querySelector<HTMLElement>(`[data-id="${detailFor.id}"] .fx`);
  if (el) { el.animate([{ transform: 'none' }, { transform: 'translate(160px, -120px) rotate(30deg) scale(.6)', opacity: 0.2 }, { transform: 'none', opacity: 1 }], { duration: 800, easing: 'cubic-bezier(.3,.7,.3,1)' }); }
  toast(`Flicked to ${f.name}`);
  setTimeout(closeDetail, 350);
});
$('d-remove').addEventListener('click', () => {
  if (!detailFor) return;
  const s = detailFor;
  const list = today();
  const i = list.findIndex((x) => x.id === s.id);
  if (i < 0) return;
  list.splice(i, 1);
  persist();
  closeDetail();
  renderToday();
  toast('Removed', () => { list.splice(i, 0, s); persist(); renderToday(); });
});

// ---------- the log sheet ----------
let cat: Category = 'audio';
let photo: string | null = null;
let found: (IdentifyResponse & { photo?: string; artSource?: string; ratio?: number; cutout?: boolean; painted?: boolean; painting?: boolean; stuck?: string }) | null = null;
const PLACEHOLDER: Record<Category, string> = { audio: 'Search a song or audiobook', book: 'Search a book or author', food: 'What did you eat or drink?' };
const VF_SUB: Record<Category, string> = { audio: 'An album cover or what is playing', book: 'The cover of the book', food: 'Your plate or your cup' };
const QUICK: Record<Category, string[]> = { audio: ['Espresso', 'Project Hail Mary', 'Birds of a Feather', 'Not Like Us'], book: ['Tomorrow, and Tomorrow, and Tomorrow', 'James', 'Fourth Wing', 'Intermezzo'], food: ['Shakshuka', 'Ube Latte', 'Smash Burger', 'Cold Brew'] };

function setCat(c: Category) {
  cat = c;
  document.querySelectorAll<HTMLButtonElement>('.seg button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.cat === c)));
  ($('q') as HTMLInputElement).placeholder = PLACEHOLDER[c];
  $('vf-sub').textContent = VF_SUB[c];
  $('chips').innerHTML = QUICK[c].map((q) => `<button type="button" data-q="${q.replace(/"/g, '&quot;')}">${q}</button>`).join('');
}
function openLog(start?: Category) {
  if (start) cat = start;
  photo = null; found = null;
  ($('q') as HTMLInputElement).value = '';
  $('vf-img').hidden = true; $('vf').classList.remove('has-photo'); $('vf-empty').hidden = false;
  $('result').hidden = true; $('log-err').hidden = true; $('scan').hidden = true;
  setCat(cat);
  $('log').hidden = false;
  const live = status?.live ?? false;
  $('muse-badge').textContent = live ? 'Muse Spark' : 'Demo';
  $('muse-badge').classList.toggle('demo', !live);
}
const closeLog = () => { $('log').hidden = true; };
document.querySelectorAll('.js-log').forEach((b) => b.addEventListener('click', () => openLog()));
$('log-close').addEventListener('click', closeLog);
document.querySelector('.seg')!.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-cat]');
  if (b) { setCat(b.dataset.cat as Category); play('pop', { volume: 0.3, rate: 1.4 }); }
});
$('chips').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-q]');
  if (b) { ($('q') as HTMLInputElement).value = b.dataset.q!; void identify(); }
});
$('search').addEventListener('submit', (e) => { e.preventDefault(); void identify(); });
($('photo') as HTMLInputElement).addEventListener('change', async () => {
  const f = ($('photo') as HTMLInputElement).files?.[0];
  ($('photo') as HTMLInputElement).value = '';
  if (!f) return;
  try {
    photo = await downsize(f);
  } catch {
    showErr('That file is not a photo we can read. Try another.');
    return;
  }
  ($('vf-img') as HTMLImageElement).src = photo;
  $('vf-img').hidden = false; $('vf').classList.add('has-photo'); $('vf-empty').hidden = true;
  void identify();
});

function showErr(msg: string) {
  $('log-err').textContent = msg;
  $('log-err').hidden = false;
}

async function identify() {
  const query = ($('q') as HTMLInputElement).value.trim();
  if (!query && !photo) { ($('q') as HTMLInputElement).focus(); return; }
  $('log-err').hidden = true;
  $('result').hidden = true;
  $('scan').hidden = false;
  $('scan-text').textContent = status?.live ? 'Muse Spark is looking' : 'Finding it';
  ($('q') as HTMLInputElement).blur();
  try {
    const body = status ? await askServer(query) : offline(query);
    if (!body.item.found) throw new Error(photo ? 'Muse could not spot a song, book or bite in that one. Try another photo or type it.' : 'Nothing found. Try another way of saying it.');
    found = { ...body };
    // What Muse Image paints from: your own plate, lifted off the table by SAM 3.1, or for music and books the
    // real cover.
    if (photo && body.item.category === 'food') await cutOut(photo, body.item);
    else {
      const known = catalogArt(body.item.title);
      if (known) found.artSource = known.source;
      else if (status) {
        $('scan-text').textContent = body.item.category === 'food' ? 'Finding a picture' : 'Finding the cover';
        const art = await fetchArt(body.item);
        if (art) { found.photo = art.photo; found.artSource = art.source; }
      }
      if (!found.photo && !known && photo) await cutOut(photo, body.item);
    }
    if (body.item.category !== cat) setCat(body.item.category);
    showResult();
    void paintFound();
  } catch (e) {
    showErr(e instanceof Error ? e.message : String(e));
  } finally {
    $('scan').hidden = true;
  }
}

/**
 * Muse Image repaints what was found (the cut-out photo or the real cover) while the result is on screen. The
 * real picture shows until the painting arrives; if it was already stuck, the sticker on the page turns into it.
 */
async function paintFound() {
  const f = found;
  if (!f || !f.photo || f.painted || !status?.live) return;
  f.painting = true;
  $('res-art').classList.add('painting');
  const was = $('res-credit').textContent;
  $('res-credit').textContent = 'Muse Image is painting it';
  const p = await requestPaint(f.photo, f.item);
  f.painting = false;
  if (found === f) {
    $('res-art').classList.remove('painting');
    $('res-credit').textContent = p ? `Painted by Muse Image from ${f.artSource ?? 'your photo'}` : was;
  }
  if (!p) return;
  f.photo = p.image; f.ratio = p.ratio; f.painted = true; f.cutout = false;
  if (found === f && !$('result').hidden) { drawResultArt(); play('pop', { volume: 0.3, rate: 1.7 }); }
  const s = f.stuck ? today().find((x) => x.id === f.stuck) : undefined;
  if (s) {
    Object.assign(s, { photo: p.image, ratio: p.ratio, painted: true, cutout: false });
    persist();
    const el = board.querySelector<HTMLElement>(`.sticker[data-id="${s.id}"] .rot`);
    if (el) { el.innerHTML = fitted(s, ART); el.closest('.fx')?.classList.add('wobble'); }
  }
}

/** Cuts the item out of the photo with SAM 3.1; without live mode, a round crop. */
async function cutOut(photo: string, item: Identified) {
  if (!found) return;
  if (status?.live) {
    $('scan-text').textContent = 'Cutting it out';
    const cut = await requestCutout(photo, item.box, item.noun);
    if (cut) {
      const c = await makeCutout(photo, cut);
      found.photo = c.image;
      found.ratio = c.ratio;
      found.cutout = true;
      return;
    }
  }
  found.photo = await cropPhoto(photo, item.box, item.category !== 'book');
}

async function askServer(query: string): Promise<IdentifyResponse> {
  const res = await fetch('api/identify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ category: cat, query: query || undefined, image: photo ?? undefined }) });
  const body = (await res.json()) as IdentifyResponse & { error?: string };
  if (!res.ok) throw new Error(body.error ?? 'Something went wrong. Try again.');
  return body;
}

/** With no server at all (a static copy of the app), search runs on the demo catalog in the browser. */
function offline(query: string): IdentifyResponse {
  if (!query) throw new Error('Photo reading needs live mode. Type what it is instead.');
  return { item: searchCatalog(query, cat), source: 'demo' };
}

function drawResultArt() {
  if (!found) return;
  const golden = ($('finished') as HTMLInputElement).checked;
  const [svg] = stickerSvg(artFor({ ...found.item, photo: found.photo, ratio: found.ratio, cutout: found.cutout, painted: found.painted, golden }), 0.72);
  $('res-art').innerHTML = svg;
}

function showResult() {
  if (!found) return;
  const it = found.item;
  const finished = $('finished') as HTMLInputElement;
  finished.checked = false;
  drawResultArt();
  finished.onchange = () => { drawResultArt(); if (finished.checked) play('chime', { rate: 1.25, volume: 0.6 }); };
  $('res-eyebrow').innerHTML = found.source === 'muse' ? '<i></i>Muse Spark sees' : '<i></i>Found it';
  $('res-title').textContent = it.title;
  $('res-meta').textContent = [it.creator, it.detail].filter(Boolean).join(' · ');
  const knownPainted = !found.photo && catalogArt(it.title)?.painted;
  $('res-credit').textContent = found.painted || knownPainted ? `Painted by Muse Image from ${found.artSource ?? 'your photo'}` : found.artSource ? `Art: ${found.artSource}` : '';
  const friend = alsoHas(it);
  const verb = it.category === 'book' ? 'is reading this too' : it.category === 'audio' ? 'played this today too' : 'had this today too';
  $('res-note').innerHTML = '';
  const typed = document.createTextNode('');
  $('res-note').append(typed);
  typeOut(typed, it.note);
  if (friend) {
    const b = document.createElement('b');
    b.textContent = ` ${friend.name} ${verb}.`;
    $('res-note').append(b);
  }
  $('finish').hidden = !(it.category === 'book' || it.kind === 'audiobook');
  $('result').hidden = false;
  play('pop', { volume: 0.35, rate: 1.5 });
}
$('res-again').addEventListener('click', () => { $('result').hidden = true; ($('q') as HTMLInputElement).focus(); });
$('stick').addEventListener('click', () => {
  if (!found) return;
  const golden = !$('finish').hidden && ($('finished') as HTMLInputElement).checked;
  const f = found;
  closeLog();
  const id = `${String(Date.now())}-${String(Math.random()).slice(2, 6)}`;
  f.stuck = id;
  setTimeout(() => stick(f.item, { id, photo: f.photo, ratio: f.ratio, cutout: f.cutout, painted: f.painted, artSource: f.artSource, golden, source: photo && f.item.category === 'food' ? 'photo' : 'search', model: f.model }), 120);
});

// ---------- friends ----------
const escAttr = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const escText = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** One face of a depth card: the cover or photo filling the tile, or a cut-out on a soft tint of its colors. */
function tileFor(it: Identified): string {
  const a = artFor(it);
  const tint = `color-mix(in srgb, ${it.colors[0] === '#1b1716' ? it.colors[1] : it.colors[0]} 26%, #fcf9ec)`;
  if (a.photo && a.frame !== 'cutout' && a.frame !== 'painted') return `<img class="tile-img" src="${escAttr(a.photo)}" alt="">`;
  if (a.photo) return `<div class="tile-cut" style="background:${tint}"><img src="${escAttr(a.photo)}" alt=""></div>`;
  return `<div class="tile-cut" style="background:${tint}">${fitted(it, 130)}</div>`;
}

function deckCaption(it: Identified, i: number, n: number): string {
  const by = it.category === 'food' ? it.detail : (it.creator.split(/,| read by /)[0] ?? '');
  const dots = Array.from({ length: n }, (_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
  return `<b>${escText(it.title)}</b><span>${escText(by)}</span><div class="dots">${dots}</div><small>Tap the card</small>`;
}

const count = (n: number | undefined, mine: boolean) => { const t = (n ?? 0) + (mine ? 1 : 0); return t ? String(t) : ''; };
function renderFriends() {
  const ms = matches(state);
  const parts: string[] = [];
  const top = ms[0];
  if (top) {
    const svg = fitted(top.item, 100);
    parts.push(`<article class="match pop"><small>A match this week</small><p></p><div class="avs">${avatar('sam', state.name)}${avatar(top.friend.id, top.friend.name)}</div><div class="art">${svg}</div></article>`);
  }
  for (const f of FRIENDS.filter((x) => !state.circle || state.circle.includes(x.id))) {
    const first = f.items[0]!;
    const mini = `<div class="deck-wrap" data-friend="${f.id}" data-i="0" role="button" tabindex="0" aria-label="${f.name}'s things today. Tap for the next one.">${deckHtml(tileFor(first), 'friend-deck')}</div><div class="deck-cap">${deckCaption(first, 0, f.items.length)}</div>`;
    const mine = state.reacted[f.id] ?? [];
    const reacts = REACTIONS.map((r) => `<button data-react="${f.id}" data-emoji="${r}" aria-pressed="${String(mine.includes(r))}" aria-label="React ${r}">${r}<span>${count(f.reactions[r], mine.includes(r))}</span></button>`).join('');
    const flicked = state.flicked.filter((x) => x.to === f.id).at(-1);
    parts.push(`<article class="friend">${avatar(f.id, f.name)}<div><div class="name">${f.name}</div><div class="when">${String(f.items.length)} things today · ${f.line}</div></div><div class="mini">${mini}</div>${flicked ? '<div class="flicked"></div>' : ''}<div class="reacts">${reacts}</div></article>`);
  }
  const feed = $('feed');
  feed.innerHTML = parts.join('');
  if (top) feed.querySelector('.match p')!.textContent = matchLine(top);
  feed.querySelectorAll<HTMLElement>('.flicked').forEach((el) => {
    const f = FRIENDS[[...feed.querySelectorAll('.friend')].indexOf(el.closest('.friend')!)];
    const x = state.flicked.filter((y) => y.to === f?.id).at(-1);
    if (x) el.textContent = `You flicked ${x.title} to ${f?.name ?? ''}`;
  });
  $('friends-count').textContent = ms.length ? `${String(ms.length)} ${ms.length === 1 ? 'match' : 'matches'}` : '';
}
// A friend's three things live on one depth card: each tap turns it to the next, with that thing's own sound.
function nextThing(wrap: HTMLElement) {
  if (wrap.dataset.busy) return;
  const f = FRIENDS.find((x) => x.id === wrap.dataset.friend);
  if (!f) return;
  const i = (Number(wrap.dataset.i) + 1) % f.items.length;
  const it = f.items[i]!;
  wrap.dataset.i = String(i);
  wrap.dataset.busy = '1';
  play('pop', { volume: 0.35, rate: 1.4 });
  setTimeout(() => {
    wrap.parentElement!.querySelector('.deck-cap')!.innerHTML = deckCaption(it, i, f.items.length);
    play(soundFor(it.category, it.kind), { volume: 0.7 });
  }, 380);
  void flip(wrap.querySelector<HTMLElement>('.deck')!, tileFor(it)).then(() => delete wrap.dataset.busy);
}

$('feed').addEventListener('keydown', (e) => {
  const w = (e.target as HTMLElement).closest<HTMLElement>('.deck-wrap');
  if (w && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); nextThing(w); }
});

$('feed').addEventListener('click', (e) => {
  const w = (e.target as HTMLElement).closest<HTMLElement>('.deck-wrap');
  if (w) { nextThing(w); return; }
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-react]');
  if (!b) return;
  const id = b.dataset.react!, emoji = b.dataset.emoji!;
  const list = (state.reacted[id] ??= []);
  const on = !list.includes(emoji);
  if (on) list.push(emoji); else list.splice(list.indexOf(emoji), 1);
  persist();
  play('pop', { rate: on ? 1.35 : 0.9, volume: 0.6 });
  const f = FRIENDS.find((x) => x.id === id)!;
  b.setAttribute('aria-pressed', String(on));
  b.querySelector('span')!.textContent = count(f.reactions[emoji], on);
  b.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 260 });
  if (on) burst(b, emoji);
});

/** A few copies of the emoji float up out of the button. */
function burst(from: HTMLElement, emoji: string) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = from.getBoundingClientRect();
  for (let i = 0; i < 6; i++) {
    const e = document.createElement('span');
    e.className = 'burst';
    e.textContent = emoji;
    e.style.left = `${String(r.left + r.width / 2)}px`;
    e.style.top = `${String(r.top)}px`;
    document.body.appendChild(e);
    const dx = (Math.random() - 0.5) * 90, dy = -60 - Math.random() * 70;
    e.animate([{ transform: 'translate(-50%, 0) scale(.6)', opacity: 1 }, { transform: `translate(calc(-50% + ${String(dx)}px), ${String(dy)}px) scale(1.2) rotate(${String(dx / 3)}deg)`, opacity: 0 }], { duration: 700 + i * 60, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = () => e.remove();
  }
}

// ---------- tonight ----------
let cardUrl: string | null = null;
let cardBlob: Blob | null = null;
let faces: { blob: Blob; url: string }[] = [];
let face = 0;
const signature = () => today().map((s) => s.id).join(',');

function renderTonight() {
  const items = today();
  const stage = $('stage');
  const opened = stage.classList.contains('open') && cardUrl;
  if (opened) return;
  stage.className = 'capsule-stage idle';
  $('share').hidden = true;
  $('actions').hidden = false;
  stage.querySelector('.empty-night')?.remove();
  if (!items.length) {
    stage.className = 'capsule-stage';
    $('tonight-hint').textContent = '';
    stage.querySelectorAll<HTMLElement>('.shell').forEach((s) => (s.style.opacity = '.25'));
    stage.insertAdjacentHTML('beforeend', '<p class="empty-night" style="position:absolute;left:0;right:0;top:50%;transform:translateY(-50%)"><b>Nothing sealed yet</b>Log a song, a book or a bite and tonight it cracks open as your card.</p>');
    $('actions').hidden = true;
    return;
  }
  stage.querySelectorAll<HTMLElement>('.shell').forEach((s) => (s.style.opacity = ''));
  $('tonight-hint').textContent = `${summary(items)}, sealed inside`;
  ($('crack-btn') as HTMLButtonElement).disabled = false;
}

$('crack-btn').addEventListener('click', () => void crack());
$('stage').addEventListener('click', (e) => {
  if ($('stage').classList.contains('idle')) { void crack(); return; }
  // The finished card turns in your hand like a piece of glass.
  const deck = (e.target as HTMLElement).closest('#card')?.querySelector<HTMLElement>('.deck');
  if (deck && $('stage').classList.contains('open')) {
    play('pop', { volume: 0.4, rate: 1.3 });
    if (faces.length > 1) {
      face = (face + 1) % faces.length;
      cardBlob = faces[face]!.blob;
      cardUrl = faces[face]!.url;
      $('tonight-hint').textContent = face ? 'Painted by Muse Image from your day' : 'Your day, on one card';
      void flip(deck, `<img src="${cardUrl}" alt="">`);
    } else void flip(deck);
  }
});

async function crack() {
  const items = today();
  if (!items.length) return;
  const stage = $('stage');
  const btn = $('crack-btn') as HTMLButtonElement;
  btn.disabled = true;
  stage.className = 'capsule-stage busy';
  let painting: string | undefined;
  const key = dayKey();
  const sig = signature();
  const cached = state.cards[key];
  if (cached && cached.startsWith(`${sig}|`)) painting = cached.slice(sig.length + 1);
  else if (status?.live) {
    $('tonight-hint').textContent = 'Muse Image is painting your day';
    try {
      const res = await fetch('api/card', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ date: key, visuals: items.map((s) => s.visual).filter(Boolean) }) });
      const body = (await res.json()) as { image?: string; error?: string };
      if (res.ok && body.image) {
        painting = body.image;
        state.cards[key] = `${sig}|${painting}`;
        persist();
      }
    } catch {
      // The stickers make the card instead.
    }
  }
  // The poster is the card. With a painting from Muse Image, it is the card's other side: a tap turns it over.
  const opts = { date: new Date(), name: state.name, chain: loggedDays(state) };
  for (const f of faces) URL.revokeObjectURL(f.url);
  faces = [];
  for (const blob of [await renderCard(items, opts), ...(painting ? [await renderCard(items, { ...opts, painting })] : [])]) faces.push({ blob, url: URL.createObjectURL(blob) });
  face = 0;
  cardBlob = faces[0]!.blob;
  cardUrl = faces[0]!.url;
  const img = new Image();
  img.src = cardUrl;
  await img.decode().catch(() => undefined);
  $('card').innerHTML = deckHtml(`<img src="${cardUrl}" alt="">`, 'card-deck');
  stage.className = 'capsule-stage open';
  play('crack');
  const r = stage.getBoundingClientRect();
  confetti(r.left + r.width / 2, r.top + r.height / 2, 160, 1.6);
  $('tonight-hint').textContent = painting ? 'Tap the card to turn it over' : 'Your day, on one card';
  $('actions').hidden = true;
  $('share').hidden = false;
}

async function share(kind: 'stories' | 'whatsapp' | 'save') {
  if (!cardBlob) return;
  const name = `consumed-${dayKey()}.png`;
  const file = new File([cardBlob], name, { type: 'image/png' });
  const text = `My day on Consumed: ${today().map((s) => s.title).join(', ')}`;
  if (kind !== 'save' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Consumed', text });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  if (kind === 'whatsapp') {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}. consumed.today`)}`, '_blank', 'noopener');
    return;
  }
  const a = document.createElement('a');
  a.href = cardUrl!;
  a.download = name;
  a.click();
  toast(kind === 'stories' ? 'Saved. Add it to your story from your photos.' : 'Saved to your downloads');
}
$('share-stories').addEventListener('click', () => void share('stories'));
$('share-wa').addEventListener('click', () => void share('whatsapp'));
$('save-card').addEventListener('click', () => void share('save'));

// ---------- menu, sound, toast ----------
function syncSound() {
  const on = !isMuted();
  $('sound-btn').setAttribute('aria-pressed', String(on));
  $('sound-btn').setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
  ($('sound-toggle') as HTMLInputElement).checked = on;
}
$('sound-btn').addEventListener('click', () => { setMuted(!isMuted()); syncSound(); play('pop'); });
($('sound-toggle') as HTMLInputElement).addEventListener('change', (e) => { setMuted(!(e.target as HTMLInputElement).checked); syncSound(); play('pop'); });
$('menu-btn').addEventListener('click', () => {
  const days = loggedDays(state);
  $('me-name').textContent = state.name;
  $('me-days').textContent = `${String(days)} ${days === 1 ? 'day' : 'days'} logged`;
  $('fresh').textContent = 'Start Fresh';
  $('menu').hidden = false;
});
$('menu').addEventListener('click', (e) => { if (e.target === $('menu')) $('menu').hidden = true; });
$('replay').addEventListener('click', () => { $('menu').hidden = true; startOnboarding(); });
$('fresh').addEventListener('click', () => {
  const b = $('fresh');
  if (b.textContent !== 'Tap Again to Clear Everything') { b.textContent = 'Tap Again to Clear Everything'; return; }
  state = startFresh();
  $('menu').hidden = true;
  renderToday();
  toast('A fresh start');
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('detail').hidden) closeDetail();
  else if (!$('menu').hidden) $('menu').hidden = true;
  else if (!$('log').hidden) closeLog();
});

let toastTimer = 0;
function toast(text: string, action?: () => void, who?: string) {
  const t = $('toast');
  t.replaceChildren(document.createTextNode(text));
  if (who) t.insertAdjacentHTML('afterbegin', `<img class="av" src="avatars/${who}.jpg" alt="">`);
  if (action) {
    const b = document.createElement('button');
    b.textContent = text.startsWith('Removed') ? 'Undo' : 'Open';
    b.onclick = () => { t.classList.remove('show'); action(); };
    t.append(b);
  }
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove('show'), 3200);
}

async function loadStatus() {
  try {
    const res = await fetch('api/status');
    status = res.ok ? ((await res.json()) as Status) : null;
  } catch {
    status = null;
  }
  const live = status?.live ?? false;
  $('muse-status').textContent = live ? 'Live' : 'Demo mode';
  $('muse-status').classList.toggle('demo', !live);
  $('muse-reason').textContent = live
    ? `Muse Spark reads your photos and searches. Muse Image paints tonight’s card. Spent $${(status?.spentUsd ?? 0).toFixed(3)} of $${(status?.budgetUsd ?? 0).toFixed(2)}.`
    : 'Search works from a small built-in catalog and the card is made from your stickers. Photos need live mode.';
}

/** Types text into a node a few letters at a time, the way Muse would say it. */
function typeOut(node: Text, text: string) {
  let i = 0;
  const step = () => {
    i = Math.min(text.length, i + 2);
    node.textContent = text.slice(0, i);
    if (i < text.length && node.isConnected) setTimeout(step, 16);
  };
  step();
}

function startOnboarding() {
  runOnboarding($('onboard'), (a) => {
    state.name = a.name;
    state.circle = a.circle;
    state.onboarded = true;
    persist();
    go('friends');
    renderFriends();
    setTimeout(() => toast('Maya waved hello', undefined, 'maya'), 700);
  });
}

// ---------- start ----------
syncSound();
await loadManifest();
renderToday();
const start = location.hash.slice(1);
go((VIEWS as readonly string[]).includes(start) ? (start as View) : 'friends', false);
void loadStatus();
if (!state.onboarded) startOnboarding();
window.addEventListener('hashchange', () => {
  const h = location.hash.slice(1);
  if ((VIEWS as readonly string[]).includes(h) && h !== view) go(h as View, false);
});
// A new day while the app is open: start a new page.
let shownDay = dayKey();
setInterval(() => { if (dayKey() !== shownDay) { shownDay = dayKey(); renderToday(); } }, 60_000);
