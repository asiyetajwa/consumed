// Consumed: the app. Three pages (Today, Friends, Tonight) and the log sheet.

import { searchCatalog } from '../shared/catalog.js';
import type { Category, IdentifyResponse, Identified, Status } from '../shared/types.js';
import { renderCard, summary } from './card.js';
import { confetti } from './confetti.js';
import { alsoHas, FRIENDS, matches, matchLine, REACTIONS } from './friends.js';
import { isMuted, play, setMuted, soundFor, unlock } from './sound.js';
import { artFor, catalogArt, fetchArt, loadManifest } from './artwork.js';
import { cropPhoto, downsize, stickerSvg } from './stickers.js';
import { dayKey, load, loggedDays, save, startFresh, type State, type Sticker } from './store.js';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const app = $('app');
let state: State = load();
let status: Status | null = null;
const VIEWS = ['today', 'friends', 'tonight'] as const;
type View = (typeof VIEWS)[number];
let view: View = 'today';

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

// ---------- today ----------
const board = $('board');

function caption(s: Sticker): string {
  if (s.category === 'food') {
    const h = new Date(s.at).getHours();
    const when = s.kind === 'drink' ? '' : h < 11 ? ', breakfast' : h < 16 ? ', lunch' : h < 21 ? ', dinner' : ', late';
    return `${s.title.toLowerCase()}${when}`;
  }
  if (s.golden) return `${s.title}, finished!`;
  if (s.category === 'audio' && s.creator) return `${s.title}, ${s.creator.split(',')[0] ?? ''}`;
  return s.title;
}

function stickerEl(s: Sticker): HTMLElement {
  const el = document.createElement('div');
  el.className = `sticker${s.golden ? ' golden' : ''}`;
  el.dataset.id = s.id;
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', `${s.title}${s.creator ? `, ${s.creator}` : ''}. Open`);
  const [svg] = stickerSvg(artFor(s), 0.8);
  el.innerHTML = `<div class="fx">${svg}<span class="cap"></span></div>`;
  el.querySelector('.cap')!.textContent = caption(s);
  place(el, s);
  wire(el, s);
  return el;
}

function place(el: HTMLElement, s: Sticker) {
  el.style.left = `${String(s.x)}%`;
  el.style.top = `${String(s.y)}%`;
  el.style.zIndex = String(s.z);
  el.style.setProperty('--r', String(s.r));
  el.style.setProperty('--s', String(s.s));
}

function renderToday() {
  const d = new Date();
  $('today-date').textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const items = today();
  $('today-count').textContent = items.length ? `${String(items.length)} consumed` : '';
  board.replaceChildren(...items.map(stickerEl));
  if (!items.length) board.insertAdjacentHTML('beforeend', '<div class="empty-board"><div><b>Your first sticker goes here</b>Log a song, a book or a bite</div></div>');
  renderDare();
  renderChain(false);
}

function renderChain(grow: boolean) {
  const days = loggedDays(state);
  const shown = Math.min(days, 9);
  const colors = ['#f6b52a', '#e8432e', '#2f6b2a', '#3c6fd8', '#6b2d5c'];
  const links = Array.from({ length: shown }, (_, i) => `<rect class="${grow && i === shown - 1 ? 'new' : ''}" x="${String(3 + i * 17)}" y="${i % 2 ? 9 : 5}" width="24" height="${i % 2 ? 14 : 22}" rx="7" fill="none" stroke="${colors[i % colors.length]!}" stroke-width="4.5"/>`).join('');
  $('chain').innerHTML = days ? `<svg width="${String(shown * 17 + 12)}" height="32" viewBox="0 0 ${String(shown * 17 + 12)} 32" aria-hidden="true">${links}</svg><span>${String(days)} ${days === 1 ? 'day' : 'days'}, no pressure</span>` : '<span>Your chain starts today</span>';
}

const PURPLE = /purple|violet|lavender|plum|ube|grape|acai|açaí|blackberr|eggplant/i;
function renderDare() {
  const leo = FRIENDS.find((f) => f.dare)!;
  const done = today().some((s) => s.category === 'food' && (PURPLE.test(s.colorName) || PURPLE.test(s.title)));
  const el = $('dare');
  el.classList.toggle('done', done);
  el.innerHTML = done ? `<small>Dare done</small>Something purple. ${leo.name} will love this.` : `<small>Today’s dare, from ${leo.name}</small>${leo.dare ?? ''}`;
  if (done && !state.dareDone[dayKey()]) {
    state.dareDone[dayKey()] = true;
    persist();
    const r = el.getBoundingClientRect();
    setTimeout(() => confetti(r.left + r.width / 2, r.top, 60, 0.6), 700);
    setTimeout(() => toast(`Dare done. ${leo.name} gets a ping.`), 900);
  }
}

/** Finds the emptiest spot on the board for a new sticker. */
function freeSpot(): [number, number] {
  const taken = today().map((s) => [s.x, s.y]);
  let best: [number, number] = [50, 45];
  let bestD = -1;
  for (let gy = 0; gy < 4; gy++) {
    for (let gx = 0; gx < 3; gx++) {
      const x = 26 + gx * 24 + (gy % 2 ? 5 : -3), y = 22 + gy * 16;
      const d = taken.length ? Math.min(...taken.map(([tx, ty]) => Math.hypot((tx! - x) * 1.1, ty! - y))) : 100 - Math.hypot(x - 50, y - 40);
      if (d > bestD) { bestD = d; best = [x, y]; }
    }
  }
  return best;
}

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
    const rect = board.getBoundingClientRect();
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
    s.x = Math.max(4, Math.min(96, start.sx + (dx / rect.width) * 100));
    s.y = Math.max(4, Math.min(96, start.sy + (dy / rect.height) * 100));
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
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.shiftKey || e.ctrlKey) s.s = Math.max(0.6, Math.min(1.7, s.s - e.deltaY * 0.002));
    else s.r += e.deltaY * 0.15;
    place(el, s);
    persist();
  }, { passive: false });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(s); return; }
    const step = e.shiftKey ? 5 : 2;
    const moves: Record<string, () => void> = {
      ArrowLeft: () => (s.x = Math.max(4, s.x - step)), ArrowRight: () => (s.x = Math.min(96, s.x + step)),
      ArrowUp: () => (s.y = Math.max(4, s.y - step)), ArrowDown: () => (s.y = Math.min(96, s.y + step)),
      '[': () => (s.r -= 8), ']': () => (s.r += 8),
    };
    const m = moves[e.key];
    if (m) { e.preventDefault(); m(); place(el, s); persist(); }
  });
}

/** A new sticker drops onto today with a wobble, its pop and its own sound. */
function stick(item: Identified, extra: Partial<Sticker>) {
  if (view !== 'today') go('today');
  const [x, y] = freeSpot();
  const firstToday = today().length === 0;
  const s: Sticker = { ...item, id: `${String(Date.now())}-${String(Math.random()).slice(2, 6)}`, at: new Date().toISOString(), x, y, r: Math.round((Math.random() - 0.5) * 18), s: 1, z: Math.max(0, ...today().map((t) => t.z)) + 1, source: 'search', ...extra };
  today().push(s);
  persist();
  board.querySelector('.empty-board')?.remove();
  const el = stickerEl(s);
  el.querySelector('.fx')!.classList.add('drop');
  board.appendChild(el);
  $('today-count').textContent = `${String(today().length)} consumed`;
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
    if (m) toast(`${m.friend.name} has this too. See Friends.`, () => go('friends'));
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
  $('d-friends').innerHTML = FRIENDS.map((f) => `<button data-flick="${f.id}" class="${state.flicked.some((x) => x.to === f.id && x.title === s.title) ? 'sent' : ''}"><span class="av" style="background:${f.color}">${f.name[0]!}</span>${f.name}</button>`).join('');
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
let found: (IdentifyResponse & { photo?: string; artSource?: string }) | null = null;
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
function openLog() {
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
$('log-btn').addEventListener('click', openLog);
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
    // Your own photo of your plate is the best picture of it. For music and books, the real cover is.
    if (photo && body.item.category === 'food') found.photo = await cropPhoto(photo, body.item.box, true);
    else {
      const known = catalogArt(body.item.title);
      if (known) found.artSource = known.source;
      else if (status) {
        $('scan-text').textContent = body.item.category === 'food' ? 'Finding a picture' : 'Finding the cover';
        const art = await fetchArt(body.item);
        if (art) { found.photo = art.photo; found.artSource = art.source; }
      }
      if (!found.photo && !known && photo) found.photo = await cropPhoto(photo, body.item.box, body.item.category !== 'book');
    }
    if (body.item.category !== cat) setCat(body.item.category);
    showResult();
  } catch (e) {
    showErr(e instanceof Error ? e.message : String(e));
  } finally {
    $('scan').hidden = true;
  }
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

function showResult() {
  if (!found) return;
  const it = found.item;
  const finished = $('finished') as HTMLInputElement;
  finished.checked = false;
  const drawArt = () => {
    const [svg] = stickerSvg(artFor({ ...it, photo: found?.photo, golden: finished.checked }), 0.72);
    $('res-art').innerHTML = svg;
  };
  drawArt();
  finished.onchange = () => { drawArt(); if (finished.checked) play('chime', { rate: 1.25, volume: 0.6 }); };
  $('res-eyebrow').innerHTML = found.source === 'muse' ? '<i></i>Muse Spark sees' : '<i></i>Found it';
  $('res-title').textContent = it.title;
  $('res-meta').textContent = [it.creator, it.detail].filter(Boolean).join(' · ');
  $('res-credit').textContent = found.artSource ? `Art: ${found.artSource}` : '';
  const friend = alsoHas(it);
  const verb = it.category === 'book' ? 'is reading this too' : it.category === 'audio' ? 'played this today too' : 'had this today too';
  $('res-note').innerHTML = '';
  $('res-note').append(document.createTextNode(it.note));
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
  setTimeout(() => stick(f.item, { photo: f.photo, artSource: f.artSource, golden, source: photo && f.item.category === 'food' ? 'photo' : 'search', model: f.model }), 120);
});

// ---------- friends ----------
const count = (n: number | undefined, mine: boolean) => { const t = (n ?? 0) + (mine ? 1 : 0); return t ? String(t) : ''; };
function renderFriends() {
  const ms = matches(state);
  const parts: string[] = [];
  const top = ms[0];
  if (top) {
    const [svg] = stickerSvg(artFor(top.item), 0.62);
    parts.push(`<article class="match pop"><small>A match this week</small><p></p><div class="avs"><span class="av">${state.name[0]!}</span><span class="av" style="background:${top.friend.color}">${top.friend.name[0]!}</span></div><div class="art">${svg}</div></article>`);
  }
  for (const f of FRIENDS) {
    const mini = f.items.map((it, i) => `<div style="transform:rotate(${String([-7, 6, -3][i] ?? 0)}deg)">${stickerSvg(artFor(it), 0.5)[0]}</div>`).join('');
    const mine = state.reacted[f.id] ?? [];
    const reacts = REACTIONS.map((r) => `<button data-react="${f.id}" data-emoji="${r}" aria-pressed="${String(mine.includes(r))}" aria-label="React ${r}">${r}<span>${count(f.reactions[r], mine.includes(r))}</span></button>`).join('');
    const flicked = state.flicked.filter((x) => x.to === f.id).at(-1);
    parts.push(`<article class="friend"><span class="av" style="background:${f.color}">${f.name[0]!}</span><div><div class="name">${f.name}</div><div class="when">${String(f.items.length)} things today · ${f.line}</div></div><div class="mini">${mini}</div>${flicked ? '<div class="flicked"></div>' : ''}<div class="reacts">${reacts}</div></article>`);
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
$('feed').addEventListener('click', (e) => {
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
});

// ---------- tonight ----------
let cardUrl: string | null = null;
let cardBlob: Blob | null = null;
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
$('stage').addEventListener('click', () => { if ($('stage').classList.contains('idle')) void crack(); });

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
  cardBlob = await renderCard(items, { date: new Date(), name: state.name, chain: loggedDays(state), painting });
  if (cardUrl) URL.revokeObjectURL(cardUrl);
  cardUrl = URL.createObjectURL(cardBlob);
  const img = $('card-img') as HTMLImageElement;
  img.src = cardUrl;
  await img.decode().catch(() => undefined);
  stage.className = 'capsule-stage open';
  play('crack');
  const r = stage.getBoundingClientRect();
  confetti(r.left + r.width / 2, r.top + r.height / 2, 160, 1.6);
  $('tonight-hint').textContent = painting ? 'Painted by Muse Image from your day' : 'Your day, on one card';
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
  $('me-days').textContent = `${String(days)} ${days === 1 ? 'day' : 'days'} logged`;
  $('fresh').textContent = 'Start Fresh';
  $('menu').hidden = false;
});
$('menu').addEventListener('click', (e) => { if (e.target === $('menu')) $('menu').hidden = true; });
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
function toast(text: string, action?: () => void) {
  const t = $('toast');
  t.replaceChildren(document.createTextNode(text));
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

// ---------- start ----------
syncSound();
await loadManifest();
renderToday();
const start = location.hash.slice(1);
go((VIEWS as readonly string[]).includes(start) ? (start as View) : 'today', false);
void loadStatus();
window.addEventListener('hashchange', () => {
  const h = location.hash.slice(1);
  if ((VIEWS as readonly string[]).includes(h) && h !== view) go(h as View, false);
});
// A new day while the app is open: start a new page.
let shownDay = dayKey();
setInterval(() => { if (dayKey() !== shownDay) { shownDay = dayKey(); renderToday(); } }, 60_000);
