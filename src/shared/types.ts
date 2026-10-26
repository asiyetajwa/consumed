// Shared between the server and the browser.

export type Category = 'audio' | 'book' | 'food';

export const SHAPES = {
  audio: ['vinyl', 'cassette', 'headphones', 'audiobook'],
  book: ['book'],
  food: ['bowl', 'plate', 'pan', 'cup', 'mug', 'burger', 'pizza', 'fruit', 'donut'],
} as const;

export type Shape = (typeof SHAPES)[Category][number];

export const ALL_SHAPES: readonly Shape[] = [...SHAPES.audio, ...SHAPES.book, ...SHAPES.food];

/** What Muse Spark (or the demo catalog) says an item is. */
export interface Identified {
  found: boolean;
  category: Category;
  /** song, album, audiobook, podcast, book, meal, snack, drink */
  kind: string;
  title: string;
  /** Artist, author, narrator, or cuisine. */
  creator: string;
  /** One short line of facts: "North African, eggs poached in spiced tomato". */
  detail: string;
  /** One warm line about it. No guilt, no calories. */
  note: string;
  shape: Shape;
  /** Three hex colors for the sticker: main, second, accent. */
  colors: [string, string, string];
  /** One plain color word for the item as a whole, for dares ("purple"). */
  colorName: string;
  /** A short visual description, used to paint the day's card. Never a title or a logo. */
  visual: string;
  /** A short noun phrase for the main object as it looks ("bowl of ramen", "bag of candy"), used to cut it out. */
  noun: string;
  /** For photos: the main subject, [x1, y1, x2, y2] on a 0 to 1000 grid. */
  box: [number, number, number, number];
}

export interface IdentifyRequest {
  category: Category;
  query?: string;
  /** A JPEG data URL, already downsized by the browser. */
  image?: string;
}

export interface IdentifyResponse {
  item: Identified;
  source: 'muse' | 'demo';
  model?: string;
  costUsd?: number;
  latencyMs?: number;
}

export interface CutoutRequest {
  image: string;
  width: number;
  height: number;
  box: [number, number, number, number];
  noun: string;
}

export interface CutoutResponse {
  /** White where the item is, as a PNG data URL, covering `bounds` in the photo's pixels. */
  mask: string;
  bounds: [number, number, number, number];
  width: number;
  height: number;
}

export interface CardRequest {
  date: string;
  visuals: string[];
}

export interface CardResponse {
  image: string; // data URL
  model: string;
  costUsd: number;
  latencyMs: number;
}

export interface Status {
  live: boolean;
  reason: string;
  textModel: string;
  imageModel: string;
  spentUsd: number;
  budgetUsd: number;
}

export interface ArtRequest {
  category: Category;
  kind: string;
  title: string;
  creator: string;
}

export interface ArtResponse {
  /** A data URL. */
  image: string;
  /** Where the artwork came from, shown as a credit. */
  source: string;
  link?: string;
}
