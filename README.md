# Consumed

**Spotify Wrapped, but every day, and for everything you consume.**

Consumed is one daily page of what you listened to, read and ate. You log something in seconds, by photo or by search, and Muse Image repaints it by hand, in the gouache and colored-pencil style of the illustrated food on realfood.gov's new food pyramid. It lands on today's page as a painting you can drag and twist. Your friends' days sit in one feed, with matches when two of you are on the same book or song. At night your day seals into a capsule that cracks open as one card, ready for Instagram Stories or WhatsApp.

Built for the Meta Global AI Developer Hackathon (Startup track, theme "Build for Your World").

## How it uses the Meta Model API

| Model | Where | What it does |
|---|---|---|
| **Muse Spark** (`muse-spark-1.3`) | Logging | Reads a photo (an album, a book cover, a plate) or a search, and returns the item as JSON through structured output: the real title and creator, a short line of facts, one warm note, a shape and three colors, a color word for dares, a short noun for the object ("bowl of pho") and the box around it. Reasoning effort is set to low to keep each log fast and cheap. |
| **SAM 3.1** (`sam-3.1`) | Logging | Lifts the dish off the table: from Muse Spark's noun, it returns the mask of the item in your photo, so Muse Image is handed the dish alone. It runs again on the finished painting, so a white bowl on cream paper keeps its rim when the painting is lifted off its background. The app closes small gaps in a mask and fills what it encloses, so a bowl keeps its soup. |
| **Muse Image** (`muse-image-1.0`) | Logging and Tonight | Repaints every item through the image edit endpoint, keeping what makes it that item: your dish, its bowl and garnish, or the real album or book cover, which becomes a painted record sleeve or a standing hardcover. At night it paints the day's items as one illustration for the back of the Consumed card, from short visual descriptions Muse Spark wrote at log time. Web search, image search and the shell tool are off for generations. |

The painting arrives on plain cream paper. The browser lifts it off (`src/shared/lift.ts`): it floods the paper in from the edges, keeps the painting's soft contact shadow as a warm, translucent grey, drops paper specks, and uses SAM 3.1's mask to protect anything paper-colored inside the dish. Until the painting arrives (about 10 seconds), the real photo or cover shows, and you can stick it straight away; the sticker turns into the painting when it is ready.

## Real artwork, repainted

Every painting starts from the real thing:
- **Music, podcasts and audiobooks:** cover art from the Apple iTunes Search API (Apple Music, Apple Podcasts, Apple Books).
- **Books:** covers from Open Library.
- **Dishes:** photos from TheMealDB.
- **Your own photos:** for food, your own photo, lifted off the table by SAM 3.1.

When none of those has a picture of a dish or drink, Muse Image pictures it first in live mode. The demo food photos in `demo-art/` were made this way.

The demo catalog is painted once ahead of time (`npm run fetch-art`, then `npm run paint-art`), so search results land as paintings at once. Paintings of our own demo photos are in `demo-art/painted/`. Third-party covers and their paintings are fetched into `art/` and never committed. Each item credits where its painting came from ("Painted by Muse Image from Apple Music"). Spotify, Audible, Kindle and Goodreads have no keyless public API for artwork, so they are not used. If Muse Image declines a cover, the real cover is used instead.

Measured on October 26, 2026:

| Call | Model | Typical time | Typical cost |
|---|---|---|---|
| Identify a search | Muse Spark | 2 to 4 s | about $0.004 |
| Identify a photo | Muse Spark | about 3 s | about $0.0045 |
| Lift a dish off a photo or a painting | SAM 3.1 | about 1 to 3 s | $0.0025 |
| Repaint an item | Muse Image | about 8 to 12 s | $0.01 |
| Picture a dish no catalog has | Muse Image | about 9 s | $0.01 |
| Paint the day's card | Muse Image | about 11 s | $0.01 |

A day with five logs (two of them photos), each repainted, and one card costs about $0.09. Catalog items are already painted, so they cost only the identify call.

Every call goes through a spend guard (`src/server/spend.ts`):
- it reserves the call's worst case before sending, at the published prices;
- it records the real cost from the returned usage in a ledger;
- it refuses anything that would pass `CONSUMED_BUDGET_USD`;
- it halts all calls on any billing error.

A per-visitor hourly allowance keeps a public deployment from draining the budget.

## Make it feel like a toy

- **A welcome, one question at a time.** Each answer collapses into a ticked line, a ring counts the steps, the line beside it changes with each step, and it ends with a thank you that types itself out.

- **Depth cards.** A friend's three things sit on one card that looks like a thick piece of glass: the picture stacked in translucent layers. Each tap tilts it in 3D, fans the layers apart, and turns to the next thing with its own sound. Tonight's Consumed card turns the same way when you tap it.
- **Hand-painted everything.** Songs, books and meals sit straight on the cream page like the food on the pyramid poster, each with its own soft shadow and nothing around it. The shareable card is a cream poster with one big black title ("Sam's Day") and your paintings piled into an upside-down pyramid; tap it to turn it over to Muse Image's painting of the whole day. You share whichever side is up.
- **Everything moves.** Drag to move, twist with two fingers to turn and resize. On a computer, scroll to turn, or use the arrow keys and `[` `]`. A new item drops in with a wobble, and Tidy Up puts everything back.
- **Sound on the core loop.** A pop when a sticker lands, then the item's own sound:
  - a chime for music and audiobooks;
  - rustling paper for books;
  - a crunchy chew for food;
  - a small burp for drinks.

  The capsule cracks open with a party popper.
- **Zero guilt.** No red numbers. The streak is a paper chain that grows each day you log and simply waits when you miss one.
- **Friend play:**
  - a match card when a friend has the same book, song or album this week;
  - reactions;
  - flicking a sticker to a friend;
  - a daily taste dare ("eat something purple today") that completes itself when you log something purple.
- **Collectibles.** Mark a book or audiobook finished and it becomes a golden sticker.

## Run it

You need Node.js 22 or later.

```bash
git clone https://github.com/asiyetajwa/consumed
cd consumed
npm install
npm start          # http://127.0.0.1:8791
npm test
```

Without a key, Consumed runs in **demo mode** at no cost:
- search uses a small built-in catalog of already painted items, and anything else still becomes a drawn sticker;
- the card is composed from your stickers;
- photos need live mode.

For **live mode**, copy `.env.example` to `.env` and set:
- `META_API_KEY`;
- `CONSUMED_LIVE=1`;
- a hard cap in `CONSUMED_BUDGET_USD`.

Your log stays in your browser. The friends in the feed are sample friends, and their profile pictures (in `src/web/avatars/`) are invented people painted with Muse Image by `scripts/make-avatars.ts`.

## Layout

- `src/server/meta.ts`: the Meta Model API calls, the JSON schema and the image prompts.
- `src/server/art.ts`: artwork from Apple, Open Library and TheMealDB.
- `scripts/fetch-art.ts`: gathers artwork for the demo catalog; `scripts/paint-art.ts` paints it.
- `src/shared/lift.ts`: lifts a painting off its paper, keeping its shadow.
- `src/web/paint.ts`: asks Muse Image to paint an item, then lifts it.
- `src/server/spend.ts`: the spend guard and ledger.
- `src/server/index.ts`: the API and static server.
- `src/shared/catalog.ts`: the demo catalog.
- `src/web/stickers.ts`: how each item is drawn: its painting, or until then its photo or cover, or a drawing from its shape and colors.
- `src/web/main.ts`: the app (Today, Friends, Tonight, the log sheet).
- `src/web/card.ts`: the 1080 by 1920 share card.
- `src/web/sound.ts`, `src/web/sfx/`: the sounds, made with ElevenLabs sound effects.

## License

MIT
