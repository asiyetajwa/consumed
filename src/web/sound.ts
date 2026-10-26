// Sound on the core loop. A pop when any sticker lands, then the item's own sound: a chime for music and
// audiobooks, rustling paper for books, a crunchy chew for food and a small burp for drinks. The capsule cracks.

export type Sfx = 'pop' | 'chime' | 'paper' | 'chew' | 'burp' | 'crack';

const FILES: Sfx[] = ['pop', 'chime', 'paper', 'chew', 'burp', 'crack'];
let ctx: AudioContext | null = null;
const buffers = new Map<Sfx, AudioBuffer>();
let loading: Promise<void> | null = null;
let muted = false;
try {
  muted = localStorage.getItem('consumed:muted') === '1';
} catch {
  // Storage can be blocked; sound simply stays on.
}

export const isMuted = () => muted;
export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem('consumed:muted', m ? '1' : '0');
  } catch {
    // ignore
  }
}

/** Call from a tap: browsers only allow audio after the person interacts. */
export function unlock(): void {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  loading ??= Promise.all(
    FILES.map(async (name) => {
      const res = await fetch(`sfx/${name}.mp3`);
      buffers.set(name, await ctx!.decodeAudioData(await res.arrayBuffer()));
    }),
  ).then(() => undefined, () => undefined);
}

export function play(name: Sfx, { volume = 1, delay = 0, rate = 1 } = {}): void {
  if (muted || !ctx) return;
  const buf = buffers.get(name);
  if (!buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = volume;
  src.connect(g).connect(ctx.destination);
  src.start(ctx.currentTime + delay);
}

/** The item's own sound, from its category and kind. */
export function soundFor(category: string, kind: string): Sfx {
  if (category === 'audio') return 'chime';
  if (category === 'book') return 'paper';
  return kind === 'drink' ? 'burp' : 'chew';
}
