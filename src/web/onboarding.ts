// The first open: a few quick questions, one at a time. Each answer collapses into a ticked line, a ring counts
// the steps, the line beside it changes with every step, and Nibs reacts to every answer. It ends with a thank
// you that types itself out.

import { confetti } from './confetti.js';
import { FRIENDS } from './friends.js';
import { nibsHtml, pose } from './nibs.js';
import { play } from './sound.js';

export interface Answers {
  name: string;
  loves: string;
  perDay: string;
  circle: string[];
}

interface Step {
  key: keyof Answers;
  label: string;
  /** The label on the ticked summary line. */
  done: string;
  hint: string;
}

const STEPS: Step[] = [
  { key: 'name', label: 'Your first name', done: 'Name', hint: 'Let’s start with your name!' },
  { key: 'loves', label: 'What do you love most?', done: 'Loves', hint: 'Curious what fills your days.' },
  { key: 'perDay', label: 'Things you enjoy a day', done: 'A day', hint: 'No pressure, just your best guess!' },
  { key: 'circle', label: 'Your circle', done: 'Circle', hint: 'Friends make every day better.' },
];
const LOVES = ['Music', 'Audiobooks', 'Books', 'Food'];
const PER_DAY = ['1', '3', '5', '10+'];

export function runOnboarding(root: HTMLElement, done: (a: Answers) => void): void {
  const a: Answers = { name: '', loves: '', perDay: '3', circle: FRIENDS.map((f) => f.id) };
  let step = 0;
  root.innerHTML = `
    <div class="ob" role="dialog" aria-modal="true" aria-labelledby="ob-title">
      <div class="ob-sky">
        <div class="ob-sun"></div>
        ${nibsHtml('wave', 'ob-nibs')}
        <div class="ob-pill" id="ob-pill"><img class="av" src="avatars/maya.jpg" alt=""><div><b>Maya</b><span>just logged a book</span></div></div>
        <div class="ob-bubble" id="ob-bubble" hidden>Thank you!</div>
      </div>
      <div class="ob-body" id="ob-body"></div>
      <div class="ob-foot" id="ob-foot">
        <svg class="ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" fill="none" stroke="#e7e1cf" stroke-width="3.5"/><circle id="ob-ring" cx="18" cy="18" r="15" fill="none" stroke="#2f6b2a" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="94.25" stroke-dashoffset="94.25" transform="rotate(-90 18 18)"/><text id="ob-count" x="18" y="21.5" text-anchor="middle" font-size="9" font-weight="800" fill="#160b06">0/4</text></svg>
        <span class="ob-hint" id="ob-hint"></span>
        <button class="ob-finish" id="ob-finish" disabled>Finish</button>
      </div>
    </div>`;
  const $ = (id: string) => root.querySelector<HTMLElement>(`#${id}`)!;
  const nibs = root.querySelector<HTMLImageElement>('.ob-nibs');
  setTimeout(() => $('ob-pill').classList.add('in'), 500);

  const value = (k: keyof Answers) => (k === 'circle' ? `${String(a.circle.length)} friends` : k === 'perDay' ? `About ${a.perDay}` : a[k]);

  function render() {
    const body = $('ob-body');
    const rows = STEPS.map((s, i) => {
      if (i < step) return `<div class="ob-row done"><span class="tick">✓</span><span>${s.done}: <b></b></span></div>`;
      if (i > step) return `<div class="ob-row later"><span class="num">${String(i + 1)}</span><span>${s.label}</span></div>`;
      return `<div class="ob-card" id="ob-card"><div class="ob-card-head"><span class="num on">${String(i + 1)}</span>${s.label}</div>${control(s.key)}</div>`;
    }).join('');
    body.innerHTML = `<p class="ob-eyebrow">Welcome</p><h2 id="ob-title">A few quick questions to make Consumed yours.</h2><div class="ob-steps">${rows}</div>`;
    body.querySelectorAll('.ob-row.done b').forEach((b, i) => (b.textContent = value(STEPS[i]!.key)));
    const n = Math.min(step, STEPS.length);
    $('ob-count').textContent = `${String(n)}/4`;
    ($('ob-ring') as unknown as SVGCircleElement).style.strokeDashoffset = String(94.25 * (1 - n / STEPS.length));
    $('ob-hint').textContent = step < STEPS.length ? STEPS[step]!.hint : 'All set. Ready when you are!';
    ($('ob-finish') as HTMLButtonElement).disabled = step < STEPS.length;
    wire();
    root.querySelector('#ob-card')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function control(k: keyof Answers): string {
    switch (k) {
      case 'name':
        return `<form class="ob-input" id="ob-form"><input id="ob-name" autocomplete="given-name" placeholder="Enter your first name" maxlength="20" value=""><button aria-label="Next">→</button></form>`;
      case 'loves':
        return `<div class="ob-choices">${LOVES.map((l) => `<button data-v="${l}">${l}</button>`).join('')}</div>`;
      case 'perDay':
        return `<div class="ob-slider"><input type="range" id="ob-range" min="0" max="3" step="1" value="1" aria-label="Things you enjoy a day"><div class="ticks">${PER_DAY.map((p) => `<span>${p}</span>`).join('')}</div><button class="ob-next" id="ob-next">That’s About Right</button></div>`;
      case 'circle':
        return `<div class="ob-circle">${FRIENDS.map((f) => `<button data-f="${f.id}" aria-pressed="true"><img class="av" src="avatars/${f.id}.jpg" alt=""><span>${f.name}</span></button>`).join('')}</div><button class="ob-next" id="ob-next">Add My Circle</button>`;
    }
  }

  function next() {
    step++;
    play('pop', { rate: 1 + step * 0.08 });
    pose(nibs, step >= STEPS.length ? 'happy' : 'happy');
    setTimeout(() => pose(nibs, step >= STEPS.length ? 'happy' : 'idle'), 900);
    render();
  }

  function wire() {
    const k = STEPS[step]?.key;
    if (k === 'name') {
      const input = root.querySelector<HTMLInputElement>('#ob-name')!;
      setTimeout(() => input.focus(), 350);
      input.addEventListener('input', () => pose(nibs, input.value ? 'look' : 'wave'));
      root.querySelector('#ob-form')!.addEventListener('submit', (e) => {
        e.preventDefault();
        const v = input.value.trim();
        if (!v) { input.focus(); root.querySelector('#ob-card')?.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 260 }); return; }
        a.name = v.charAt(0).toUpperCase() + v.slice(1);
        next();
      });
    } else if (k === 'loves') {
      root.querySelectorAll<HTMLButtonElement>('.ob-choices button').forEach((b) => b.addEventListener('click', () => {
        root.querySelectorAll('.ob-choices button').forEach((x) => x.classList.toggle('on', x === b));
        a.loves = b.dataset.v!;
        play(b.dataset.v === 'Food' ? 'chew' : b.dataset.v === 'Books' ? 'paper' : 'chime', { volume: 0.6 });
        setTimeout(next, 380);
      }));
    } else if (k === 'perDay') {
      const r = root.querySelector<HTMLInputElement>('#ob-range')!;
      r.addEventListener('input', () => { a.perDay = PER_DAY[Number(r.value)]!; pose(nibs, Number(r.value) >= 2 ? 'love' : 'look'); play('pop', { volume: 0.3, rate: 1.2 + Number(r.value) * 0.1 }); });
      root.querySelector('#ob-next')!.addEventListener('click', next);
    } else if (k === 'circle') {
      root.querySelectorAll<HTMLButtonElement>('.ob-circle button').forEach((b) => b.addEventListener('click', () => {
        const on = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', String(on));
        a.circle = on ? [...a.circle, b.dataset.f!] : a.circle.filter((x) => x !== b.dataset.f);
        play('pop', { volume: 0.5, rate: on ? 1.3 : 0.9 });
      }));
      root.querySelector('#ob-next')!.addEventListener('click', next);
    }
  }

  $('ob-finish').addEventListener('click', () => {
    play('chime');
    pose(nibs, 'love');
    $('ob-bubble').hidden = false;
    $('ob-pill').classList.remove('in');
    const r = nibs!.getBoundingClientRect();
    confetti(r.left + r.width / 2, r.top + r.height / 2, 110, 1.4);
    $('ob-foot').classList.add('gone');
    $('ob-body').innerHTML = `<p class="ob-eyebrow green">All set</p><h2 id="ob-title"></h2><p class="ob-type" id="ob-type"></p><button class="ob-go" id="ob-go">See What Friends Enjoyed Today</button>`;
    $('ob-title').textContent = `Thank you, ${a.name}. Welcome to Consumed.`;
    const text = `Every song, page and bite you log becomes a sticker on today. ${a.circle.length ? `${String(a.circle.length)} friends are already here, and they will see your day as it happens.` : 'Add friends any time.'} Tonight your day cracks open as one card to share.`;
    const out = $('ob-type');
    let i = 0;
    const tick = () => {
      out.textContent = text.slice(0, i);
      out.classList.toggle('caret', i < text.length);
      if (i++ < text.length) setTimeout(tick, 14);
    };
    tick();
    $('ob-go').addEventListener('click', () => {
      root.querySelector('.ob')!.classList.add('leaving');
      setTimeout(() => { root.innerHTML = ''; done(a); }, 380);
    });
  });

  render();
}
