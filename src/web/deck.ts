// A depth card: the picture stacked in six translucent layers, each a little larger and further back, so the
// card reads as a thick piece of glass. A tap tilts it in 3D, fans the layers apart in depth, swaps in the next
// picture at the turn, and lets it settle.

const LAYERS = 6;
const rest = (i: number) => `translateZ(${String(-i * 4)}px) scale(${String(1 + i * 0.03)})`;
const spread = (i: number) => `translateZ(${String(-i * 46)}px) scale(${String(1 + i * 0.045)})`;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The markup for a deck showing `face` (the inner HTML of one layer). */
export function deckHtml(face: string, cls = ''): string {
  const layers = Array.from({ length: LAYERS }, (_, k) => {
    const i = LAYERS - 1 - k; // back layers first
    return `<div class="layer${i === 0 ? ' front' : ''}" style="transform:${rest(i)};opacity:${String(i === 0 ? 1 : 0.55 - i * 0.07)}">${face}</div>`;
  }).join('');
  return `<div class="deck ${cls}"><div class="stack">${layers}</div></div>`;
}

// The turns, used in order so each tap feels a little different: tip back, swing left, swing right, a soft blur.
const TURNS = ['rotateX(62deg)', 'rotateY(-58deg)', 'rotateY(58deg)', 'blur'] as const;
const counts = new WeakMap<HTMLElement, number>();

/** Plays the turn. With `next`, the picture changes at the moment the card is edge-on. */
export function flip(deck: HTMLElement, next?: string): Promise<void> {
  const stack = deck.querySelector<HTMLElement>('.stack')!;
  const layers = [...stack.querySelectorAll<HTMLElement>('.layer')].reverse(); // front first
  const swap = () => { if (next !== undefined) for (const l of layers) l.innerHTML = next; };
  if (reduced()) {
    swap();
    return Promise.resolve();
  }
  const n = counts.get(deck) ?? 0;
  counts.set(deck, n + 1);
  const turn = TURNS[n % TURNS.length]!;
  const ms = 1150;
  const ease = 'cubic-bezier(.3, .7, .2, 1)';
  if (turn === 'blur') {
    layers.forEach((l, i) => l.animate([
      { transform: rest(i), filter: 'blur(0)' },
      { transform: spread(i), filter: `blur(${String(4 + i)}px)`, offset: 0.45 },
      { transform: rest(i), filter: 'blur(0)' },
    ], { duration: ms, easing: ease }));
    stack.animate([{ transform: 'none' }, { transform: 'scale(.9) translateY(6px)', offset: 0.45 }, { transform: 'scale(1.03)', offset: 0.72 }, { transform: 'none' }], { duration: ms, easing: ease });
  } else {
    const back = turn.replace(/(-?\d+)deg/, (_, d: string) => `${String(-Number(d) * 0.12)}deg`); // a small overshoot the other way
    layers.forEach((l, i) => l.animate([{ transform: rest(i) }, { transform: spread(i), offset: 0.38 }, { transform: spread(i), offset: 0.5 }, { transform: rest(i) }], { duration: ms, easing: ease }));
    stack.animate([{ transform: 'none' }, { transform: `${turn} scale(.9)`, offset: 0.38 }, { transform: `${turn} scale(.9)`, offset: 0.5 }, { transform: back, offset: 0.78 }, { transform: 'none' }], { duration: ms, easing: ease });
  }
  return new Promise((resolve) => {
    setTimeout(swap, ms * 0.45);
    setTimeout(resolve, ms);
  });
}
