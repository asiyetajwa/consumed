// The person's log, kept in this browser. Days are keyed by local date. A first visit starts with eleven earlier
// days of sample stickers so the paper chain has something to show; "Start Fresh" clears them.

import { CATALOG } from '../shared/catalog.js';
import type { Identified } from '../shared/types.js';

export interface Sticker extends Identified {
  id: string;
  at: string;
  /** Centre on the board, in percent. */
  x: number;
  y: number;
  r: number;
  s: number;
  z: number;
  photo?: string;
  golden?: boolean;
  source: 'photo' | 'search';
  model?: string;
}

export interface Reaction {
  friend: string;
  emoji: string;
}

export interface State {
  name: string;
  days: Record<string, Sticker[]>;
  /** Reactions you gave, by friend id and emoji. */
  reacted: Record<string, string[]>;
  flicked: { to: string; title: string; at: string }[];
  dareDone: Record<string, boolean>;
  cards: Record<string, string>;
  sample: boolean;
}

const KEY = 'consumed:v1';

export const dayKey = (d = new Date()) => `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function sampleDays(): Record<string, Sticker[]> {
  const days: Record<string, Sticker[]> = {};
  const pool = CATALOG.filter((c) => !['Tomorrow, and Tomorrow, and Tomorrow', 'Espresso', 'Shakshuka', 'Ube Latte', 'Purple Grapes', 'Açaí Bowl', 'Good Luck, Babe!', 'Fourth Wing'].includes(c.title));
  for (let back = 11; back >= 1; back--) {
    const d = new Date();
    d.setDate(d.getDate() - back);
    const n = 1 + (back % 3);
    days[dayKey(d)] = Array.from({ length: n }, (_, i) => {
      const { words: _w, ...c } = pool[(back * 3 + i * 5) % pool.length]!;
      return { ...c, found: true, box: [0, 0, 1000, 1000] as [number, number, number, number], id: `sample-${String(back)}-${String(i)}`, at: d.toISOString(), x: 28 + i * 24, y: 40 + (i % 2) * 22, r: (i % 2 ? 6 : -5), s: 1, z: i, source: 'search' as const };
    });
  }
  return days;
}

function fresh(sample: boolean): State {
  return { name: 'Sam', days: sample ? sampleDays() : {}, reacted: {}, flicked: [], dareDone: {}, cards: {}, sample };
}

export function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(false), ...(JSON.parse(raw) as State) };
  } catch {
    // Fall through to a new log.
  }
  return fresh(true);
}

export function save(s: State): void {
  try {
    // Cards are big; keep only today's so storage never fills up.
    const today = dayKey();
    const cards = s.cards[today] ? { [today]: s.cards[today] } : {};
    localStorage.setItem(KEY, JSON.stringify({ ...s, cards }));
  } catch {
    // Storage full or blocked: the session still works, it just will not persist.
  }
}

export function startFresh(): State {
  const s = fresh(false);
  save(s);
  return s;
}

export function loggedDays(s: State): number {
  return Object.values(s.days).filter((d) => d.length > 0).length;
}

export const normTitle = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
