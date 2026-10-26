// Seeded demo friends and their days. Matches are computed against your log: the same book, song or album
// as a friend this week becomes a match card in the feed.

import { CATALOG, nounFor } from '../shared/catalog.js';
import type { Identified } from '../shared/types.js';
import { normTitle, type State, type Sticker } from './store.js';

export interface Friend {
  id: string;
  name: string;
  color: string;
  line: string;
  items: Identified[];
  dare?: string;
  /** Reactions other people already left, by emoji. */
  reactions: Record<string, number>;
}

const pick = (title: string): Identified => {
  const c = CATALOG.find((x) => x.title === title);
  if (!c) throw new Error(`Missing catalog item ${title}`);
  const { words: _w, ...rest } = c;
  return { ...rest, noun: nounFor(rest.shape), found: true, box: [0, 0, 1000, 1000] };
};

export const FRIENDS: Friend[] = [
  { id: 'maya', name: 'Maya', color: '#f3a0b5', line: 'Reading on the train again', items: [pick('Tomorrow, and Tomorrow, and Tomorrow'), pick('Iced Matcha Latte'), pick('Birds of a Feather')], reactions: { '\u{1F4D6}': 3, '\u{1F60B}': 1 } },
  { id: 'leo', name: 'Leo', color: '#9ccbe8', line: 'Dared you to eat something purple', items: [pick('Purple Grapes'), pick('Smartless'), pick('Good Luck, Babe!')], dare: 'Eat something purple today', reactions: { '\u{1F3A7}': 2 } },
  { id: 'jordan', name: 'Jordan', color: '#f6b52a', line: 'Lunch break soundtrack', items: [pick('Espresso'), pick('Smash Burger'), pick('Cold Brew')], reactions: { '\u{1F60B}': 4, '\u{1F525}': 2 } },
  { id: 'priya', name: 'Priya', color: '#a7d58e', line: 'Dragons until 2 AM', items: [pick('Fourth Wing'), pick('Tonkotsu Ramen'), pick('Project Hail Mary')], reactions: { '\u{1F409}': 5 } },
];

export const REACTIONS = ['\u{1F60B}', '\u{1F3A7}', '\u{1F4D6}', '\u{1F525}'];

export interface Match {
  friend: Friend;
  item: Identified;
  mine: Sticker;
}

/** Your items from the last seven days that a friend also has. Newest of yours first. */
export function matches(s: State): Match[] {
  const mine: Sticker[] = [];
  for (let back = 0; back < 7; back++) {
    const d = new Date();
    d.setDate(d.getDate() - back);
    const key = `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    mine.push(...(s.days[key] ?? []));
  }
  mine.sort((a, b) => b.at.localeCompare(a.at));
  const out: Match[] = [];
  for (const m of mine) {
    if (m.category === 'food') continue; // two friends on the same dish is a coincidence, not a match
    for (const f of FRIENDS) {
      const it = f.items.find((i) => normTitle(i.title) === normTitle(m.title));
      if (it && !out.some((o) => o.friend.id === f.id && normTitle(o.item.title) === normTitle(it.title))) out.push({ friend: f, item: it, mine: m });
    }
  }
  return out;
}

export function matchLine(m: Match): string {
  const verb = m.item.category === 'book' ? 'reading' : m.item.kind === 'audiobook' ? 'listening to' : 'playing';
  return `You and ${m.friend.name} are both ${verb} ${m.item.title}`;
}

/** The friend who has the same thing as a just-identified item, for the "Maya is reading this too" line. */
export function alsoHas(item: Identified): Friend | undefined {
  if (item.category === 'food') return FRIENDS.find((f) => f.items.some((i) => normTitle(i.title) === normTitle(item.title) && i.category === 'food'));
  return FRIENDS.find((f) => f.items.some((i) => normTitle(i.title) === normTitle(item.title)));
}
