// The demo catalog: what search finds when live calls are off. Live mode asks Muse Spark instead, which knows far
// more than this list. Anything not here still becomes a plain sticker, so the app never dead-ends.

import { SHAPES, type Category, type Identified, type Shape } from './types.js';

type Entry = Omit<Identified, 'found' | 'box'> & { words?: string };

const e = (category: Category, kind: string, title: string, creator: string, detail: string, note: string, shape: Shape, colors: [string, string, string], colorName: string, visual: string, words = ''): Entry =>
  ({ category, kind, title, creator, detail, note, shape, colors, colorName, visual, words });

export const CATALOG: Entry[] = [
  // Audio
  e('audio', 'song', 'Espresso', 'Sabrina Carpenter', 'Pop single, 2024', 'Still the most replayable two minutes and fifty seconds of the year.', 'vinyl', ['#1b1716', '#f3a0b5', '#fff4e8'], 'pink', 'a black vinyl record with a pink label'),
  e('audio', 'song', 'Good Luck, Babe!', 'Chappell Roan', 'Pop single, 2024', 'A big chorus for a big day.', 'cassette', ['#e8432e', '#f3a0b5', '#fcf9ec'], 'red', 'a red cassette tape with a pink label'),
  e('audio', 'song', 'Birds of a Feather', 'Billie Eilish', 'From Hit Me Hard and Soft, 2024', 'Soft, sunny and impossible to hum only once.', 'vinyl', ['#1b1716', '#7fb3e6', '#fcf9ec'], 'blue', 'a black vinyl record with a pale blue label'),
  e('audio', 'song', 'Texas Hold ’Em', 'Beyoncé', 'Country pop, 2024', 'Instant line dance energy.', 'vinyl', ['#1b1716', '#d9a441', '#fcf9ec'], 'gold', 'a black vinyl record with a gold label', 'texas hold em'),
  e('audio', 'album', 'Short n’ Sweet', 'Sabrina Carpenter', 'Album, 2024, 12 tracks', 'A whole album that feels like a sunny afternoon.', 'vinyl', ['#1b1716', '#9cc7f0', '#fcf9ec'], 'blue', 'a black vinyl record with a sky blue label', 'short n sweet'),
  e('audio', 'audiobook', 'Project Hail Mary', 'Andy Weir, read by Ray Porter', 'Audiobook, 16 hours', 'A narrator this good makes the commute fly by.', 'audiobook', ['#f0a43a', '#1d2a44', '#fcf9ec'], 'orange', 'headphones resting on an orange book'),
  e('audio', 'audiobook', 'Atomic Habits', 'James Clear', 'Audiobook, 5 hours 35 minutes', 'Small listening, big ideas.', 'audiobook', ['#f4efdc', '#e8a33a', '#1b1716'], 'cream', 'headphones resting on a cream book'),
  e('audio', 'podcast', 'Smartless', 'Jason Bateman, Sean Hayes, Will Arnett', 'Comedy podcast', 'Guaranteed laughs on the walk home.', 'headphones', ['#3c6fd8', '#fcf9ec', '#1b1716'], 'blue', 'blue over-ear headphones'),
  // Books
  e('book', 'book', 'Tomorrow, and Tomorrow, and Tomorrow', 'Gabrielle Zevin', 'Novel, 2022, 416 pages', 'A love letter to friendship and video games.', 'book', ['#2c5aa0', '#f4efdc', '#e8432e'], 'blue', 'a blue hardcover book with a painted wave on the cover', 'tomorrow tomorrow zevin'),
  e('book', 'book', 'Fourth Wing', 'Rebecca Yarros', 'Fantasy, 2023, 528 pages', 'Dragons, a war college and zero chance of sleeping early.', 'book', ['#1b1716', '#d9a441', '#fcf9ec'], 'black', 'a black book with a gold dragon on the cover'),
  e('book', 'book', 'The Midnight Library', 'Matt Haig', 'Novel, 2020, 304 pages', 'Every page a new life to try on.', 'book', ['#1f3a5f', '#d9a441', '#fcf9ec'], 'navy', 'a navy book with gold stars on the cover'),
  e('book', 'book', 'James', 'Percival Everett', 'Novel, 2024, 320 pages', 'A Pulitzer winner that reads like a page-turner.', 'book', ['#c9b48a', '#1b1716', '#e8432e'], 'tan', 'a tan book with a black silhouette on the cover'),
  e('book', 'book', 'Intermezzo', 'Sally Rooney', 'Novel, 2024, 448 pages', 'Two brothers, one chessboard of feelings.', 'book', ['#f4efdc', '#e8432e', '#1b1716'], 'cream', 'a cream book with red lettering shapes'),
  e('book', 'book', 'Lessons in Chemistry', 'Bonnie Garmus', 'Novel, 2022, 400 pages', 'Sharp, funny and full of pencils behind ears.', 'book', ['#e8432e', '#f6b52a', '#1b1716'], 'red', 'a red book with a woman in a yellow pencil-skirt on the cover'),
  e('book', 'book', 'Pride and Prejudice', 'Jane Austen', 'Novel, 1813', 'Still the best banter in English.', 'book', ['#2f6b2a', '#f4efdc', '#d9a441'], 'green', 'a green clothbound book with gold vines'),
  // Food and drink
  e('food', 'meal', 'Shakshuka', 'North African', 'Eggs poached in spiced tomato', 'Good pick. Breakfast that feels like a weekend.', 'pan', ['#c6341f', '#fffaf0', '#f6b52a'], 'red', 'a cast iron pan of shakshuka with three eggs and herbs'),
  e('food', 'drink', 'Ube Latte', 'Filipino inspired', 'Purple yam, milk and ice', 'The prettiest purple in the whole cafe.', 'cup', ['#8b5fbf', '#efe4ff', '#fcf9ec'], 'purple', 'a tall iced purple latte with a straw', 'ube purple yam'),
  e('food', 'meal', 'Açaí Bowl', 'Brazilian', 'Açaí, banana, granola, berries', 'A bowl that looks like a sunset in purple.', 'bowl', ['#5b2a6e', '#f6d36b', '#e8432e'], 'purple', 'a purple acai bowl topped with banana slices and granola', 'acai'),
  e('food', 'meal', 'Tonkotsu Ramen', 'Japanese', 'Pork broth, noodles, soft egg', 'A bowl you hold with both hands.', 'bowl', ['#f2d9a6', '#f6b52a', '#2f6b2a'], 'cream', 'a ramen bowl with noodles, a soft boiled egg and scallions', 'ramen noodles'),
  e('food', 'meal', 'Smash Burger', 'American', 'Two thin patties, cheese, pickles', 'Crispy edges, melty middle, very correct.', 'burger', ['#c97b2c', '#f6b52a', '#3f8a2e'], 'brown', 'a double smash burger with melted cheese and pickles', 'cheeseburger burger'),
  e('food', 'meal', 'Pepperoni Pizza', 'New York style', 'A big foldable slice', 'The fold is the whole point.', 'pizza', ['#f6c453', '#c6341f', '#fcf9ec'], 'red', 'a big slice of pepperoni pizza', 'pizza slice'),
  e('food', 'drink', 'Iced Matcha Latte', 'Japanese inspired', 'Matcha, oat milk, ice', 'Calm, green and very photogenic.', 'cup', ['#7fae5a', '#eef5e0', '#fcf9ec'], 'green', 'a tall iced matcha latte with a straw', 'matcha'),
  e('food', 'drink', 'Cappuccino', 'Italian', 'Espresso and foamed milk', 'Foam on the lip is a feature.', 'mug', ['#e8432e', '#b07a4f', '#fcf9ec'], 'brown', 'a red mug of cappuccino with latte art', 'coffee'),
  e('food', 'drink', 'Cold Brew', 'Coffee', 'Steeped overnight, over ice', 'Smooth fuel for a long afternoon.', 'cup', ['#4a2c1a', '#d9b48a', '#fcf9ec'], 'brown', 'a tall iced cold brew coffee with a straw', 'iced coffee'),
  e('food', 'dessert', 'Glazed Donut', 'Bakery', 'Yeast donut, sugar glaze', 'Shiny, soft and gone in four bites.', 'donut', ['#f3a0b5', '#d9a441', '#fcf9ec'], 'pink', 'a pink glazed donut with sprinkles', 'doughnut'),
  e('food', 'snack', 'Purple Grapes', 'Fruit', 'A big bunch, cold from the fridge', 'Nature’s candy, purple edition.', 'fruit', ['#6b2d5c', '#5c7a2a', '#fcf9ec'], 'purple', 'a bunch of purple grapes', 'grape'),
  e('food', 'meal', 'Avocado Toast', 'Cafe', 'Sourdough, avocado, chili flakes', 'Crunchy, creamy and right on time.', 'plate', ['#f4efdc', '#7fae5a', '#e8432e'], 'green', 'avocado toast on a white plate with chili flakes', 'avocado'),
  e('food', 'meal', 'Pad Thai', 'Thai', 'Rice noodles, peanuts, lime', 'Sweet, sour and a squeeze of lime.', 'plate', ['#f4efdc', '#e8a33a', '#7fae5a'], 'orange', 'a plate of pad thai with lime and peanuts'),
  e('food', 'meal', 'Tacos al Pastor', 'Mexican', 'Pork, pineapple, cilantro, onion', 'Three is the right number of tacos.', 'plate', ['#f4efdc', '#e8432e', '#f6b52a'], 'orange', 'three tacos al pastor with pineapple on a plate', 'taco tacos'),
  e('food', 'meal', 'Pancakes', 'Diner', 'A short stack with maple syrup', 'A short stack makes any morning longer.', 'plate', ['#f4efdc', '#d99a4a', '#f6b52a'], 'gold', 'a short stack of pancakes with syrup and butter', 'pancake'),
  e('food', 'meal', 'Caesar Salad', 'American', 'Romaine, parmesan, croutons', 'Crunchy and bright.', 'bowl', ['#fcf9ec', '#7fae5a', '#f6d36b'], 'green', 'a bowl of caesar salad with croutons', 'salad'),
];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

export function searchCatalog(query: string, category: Category): Identified {
  const q = norm(query);
  const words = q.split(' ').filter((w) => w.length > 1);
  let best: Entry | null = null;
  let bestScore = 0;
  for (const it of CATALOG) {
    const hay = norm(`${it.title} ${it.creator} ${it.kind} ${it.words ?? ''}`);
    let s = norm(it.title) === q ? 10 : 0;
    for (const w of words) if (hay.includes(w)) s += w.length > 2 ? 2 : 1;
    if (it.category === category) s += 0.5;
    if (s > bestScore) {
      bestScore = s;
      best = it;
    }
  }
  if (best && bestScore >= 2) {
    const { words: _w, ...item } = best;
    return { ...item, found: true, box: [0, 0, 1000, 1000] };
  }
  return plainItem(query, category);
}

/** A sticker for anything the catalog does not know, drawn from the category's first shape. */
export function plainItem(query: string, category: Category): Identified {
  const title = query.trim().replace(/\s+/g, ' ').slice(0, 60).replace(/^./, (c) => c.toUpperCase()) || 'Something good';
  const shape = SHAPES[category][0];
  const notes = { audio: 'Added to today’s soundtrack.', book: 'A new page in today’s story.', food: 'Logged and delicious.' };
  return {
    found: true,
    category,
    kind: category === 'audio' ? 'song' : category === 'book' ? 'book' : 'meal',
    title,
    creator: '',
    detail: '',
    note: notes[category],
    shape,
    colors: category === 'audio' ? ['#1b1716', '#f6b52a', '#fcf9ec'] : category === 'book' ? ['#2f6b2a', '#f4efdc', '#e8432e'] : ['#fcf9ec', '#e8432e', '#f6b52a'],
    colorName: '',
    visual: category === 'audio' ? 'a black vinyl record with a yellow label' : category === 'book' ? 'a green hardcover book' : 'a colorful plate of food',
    box: [0, 0, 1000, 1000],
  };
}
