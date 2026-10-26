// Real artwork for a logged item, from free public catalogs that need no key:
//   music, podcasts and audiobooks: the Apple iTunes Search API (Apple Music, Apple Podcasts, Apple Books);
//   books: Open Library covers;
//   dishes: TheMealDB.
// Images come back as data URLs so the browser can cut them into stickers and draw them on the card.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ArtRequest, ArtResponse } from '../shared/types.js';

const UA = 'Consumed/0.1 (hackathon demo; https://github.com/asiyetajwa/consumed)';
const CACHE = process.env.CONSUMED_ART_CACHE?.trim() || join(process.cwd(), '.art-cache');
const memory = new Map<string, ArtResponse | null>();

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(12_000) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

async function getImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(15_000) });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !type.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1500 || buf.length > 2_500_000) return null; // Open Library answers a 1x1 gif for "no cover"
    return `data:${type.split(';')[0] ?? 'image/jpeg'};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

/** How close a catalog title is to what we asked for: exact beats "Espresso (On Vacation Version)". */
function closeness(want: string, got: string): number {
  // "Atomic Habits: An Easy & Proven Way... (Unabridged)" is the same book as "Atomic Habits".
  const a = norm(want), b = norm(got.replace(/\([^)]*\)|\[[^\]]*\]/g, '').split(/:| - /)[0] ?? '');
  if (!a || !b) return 0;
  if (a === b) return 3;
  if (b.startsWith(a) || a.startsWith(b)) return 2 - Math.min(1, Math.abs(b.length - a.length) / 40);
  return a.split(' ').filter((w) => b.includes(w)).length / a.split(' ').length;
}

interface ITunes {
  results?: { trackName?: string; collectionName?: string; artistName?: string; artworkUrl100?: string; artworkUrl600?: string; trackViewUrl?: string; collectionViewUrl?: string }[];
}

async function apple(req: ArtRequest): Promise<ArtResponse | null> {
  const entity = req.kind === 'album' ? 'album' : req.kind === 'audiobook' ? 'audiobook' : req.kind === 'podcast' ? 'podcast' : 'song';
  const by = (req.creator.split(/,| read by | narrated by /i)[0] ?? '').trim();
  const json = await getJson<ITunes>(`https://itunes.apple.com/search?country=US&lang=en_us&limit=8&entity=${entity}&term=${encodeURIComponent(`${req.title} ${by}`.trim())}`);
  const hits = (json?.results ?? []).filter((r) => r.artworkUrl100);
  let best: (typeof hits)[number] | undefined;
  let bestScore = 0;
  for (const r of hits) {
    const name = entity === 'song' ? r.trackName : r.collectionName;
    const s = closeness(req.title, name ?? '') + (by && norm(r.artistName ?? '').includes(norm(by).split(' ')[0] ?? '') ? 1 : 0);
    if (s > bestScore) { bestScore = s; best = r; }
  }
  if (!best || bestScore < 1.5) return null;
  const url = (best.artworkUrl600 ?? best.artworkUrl100!).replace(/\/\d+x\d+bb\./, '/600x600bb.');
  const image = await getImage(url);
  if (!image) return null;
  const source = entity === 'audiobook' ? 'Apple Books' : entity === 'podcast' ? 'Apple Podcasts' : 'Apple Music';
  return { image, source, link: best.trackViewUrl ?? best.collectionViewUrl };
}

interface OpenLibrary {
  docs?: { title?: string; author_name?: string[]; cover_i?: number; key?: string }[];
}

async function openLibrary(req: ArtRequest): Promise<ArtResponse | null> {
  const author = (req.creator.split(',')[0] ?? '').trim();
  const q = `title=${encodeURIComponent(req.title)}${author ? `&author=${encodeURIComponent(author)}` : ''}`;
  const json = await getJson<OpenLibrary>(`https://openlibrary.org/search.json?${q}&limit=6&fields=title,author_name,cover_i,key`);
  const doc = (json?.docs ?? []).filter((d) => d.cover_i).sort((x, y) => closeness(req.title, y.title ?? '') - closeness(req.title, x.title ?? ''))[0];
  if (!doc || closeness(req.title, doc.title ?? '') < 1) return null;
  const image = await getImage(`https://covers.openlibrary.org/b/id/${String(doc.cover_i)}-L.jpg`);
  return image ? { image, source: 'Open Library', link: doc.key ? `https://openlibrary.org${doc.key}` : undefined } : null;
}

interface MealDb {
  meals?: { strMeal?: string; strMealThumb?: string; idMeal?: string }[] | null;
}

async function mealDb(req: ArtRequest): Promise<ArtResponse | null> {
  const json = await getJson<MealDb>(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(req.title)}`);
  const meal = (json?.meals ?? []).sort((x, y) => closeness(req.title, y.strMeal ?? '') - closeness(req.title, x.strMeal ?? ''))[0];
  if (!meal?.strMealThumb || closeness(req.title, meal.strMeal ?? '') < 1) return null;
  const image = await getImage(meal.strMealThumb);
  return image ? { image, source: 'TheMealDB', link: meal.idMeal ? `https://www.themealdb.com/meal/${meal.idMeal}` : undefined } : null;
}

export async function findArt(req: ArtRequest): Promise<ArtResponse | null> {
  const key = createHash('sha1').update(JSON.stringify([req.category, req.kind, norm(req.title), norm(req.creator)])).digest('hex');
  if (memory.has(key)) return memory.get(key) ?? null;
  const file = join(CACHE, `${key}.json`);
  if (existsSync(file)) {
    const hit = JSON.parse(readFileSync(file, 'utf8')) as ArtResponse | null;
    memory.set(key, hit);
    return hit;
  }
  const art = req.category === 'audio' ? await apple(req) : req.category === 'book' ? await openLibrary(req) : req.kind === 'drink' ? null : await mealDb(req);
  memory.set(key, art);
  try {
    mkdirSync(CACHE, { recursive: true });
    if (art) writeFileSync(file, JSON.stringify(art));
  } catch {
    // The cache is a convenience.
  }
  return art;
}
