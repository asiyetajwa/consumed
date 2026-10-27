# Consumed

**Spotify Wrapped, but every day, and for everything you consume.**

Consumed is one daily page of what you listened to, read and ate. You log something in seconds, by photo or by search, and it lands on today's page as a glossy sticker you can drag and twist. Your friends' days sit in one feed, with matches when two of you are on the same book or song. At night your day seals into a capsule that cracks open as one card, ready for Instagram Stories or WhatsApp.

Built for the Meta Global AI Developer Hackathon (Startup track, theme "Build for Your World").

## How it uses the Meta Model API

| Model | Where | What it does |
|---|---|---|
| **Muse Spark** (`muse-spark-1.3`) | Logging | Reads a photo (an album, a book cover, a plate) or a search, and returns the item as JSON through structured output: the real title and creator, a short line of facts, one warm note, the sticker shape and three colors from the photo, a color word for dares, and the box around the main subject so the photo itself becomes a die-cut sticker. Reasoning effort is set to low to keep each log fast and cheap. |
| **SAM 3.1** (`sam-3.1`) | Logging | Cuts the item out of your photo along its own outline. Muse Spark names the object ("bowl of pho", "bag of candy") and SAM 3.1 returns its mask. The app closes small gaps in a rim and fills what it encloses, so a bowl keeps its soup. The sticker is the cut-out in the Pop Poster style: a white die-cut edge, a thick ring in the item's own color and a hard ink shadow. |
| **Muse Image** (`muse-image-1.0`) | Tonight, and food pictures | Pictures a dish or drink no public catalog has a photo of. Paints the day's items as one illustration for the back of the Consumed card, from short visual descriptions Muse Spark wrote at log time. Web search, image search and the shell tool are turned off, and the prompt asks for no text or logos. |

## Real artwork

Stickers show the real thing whenever there is a picture of it:
- **Music, podcasts and audiobooks:** cover art from the Apple iTunes Search API (Apple Music, Apple Podcasts, Apple Books).
- **Books:** covers from Open Library.
- **Dishes:** photos from TheMealDB.
- **Your own photos:** for food, your photo is the sticker, cut out along the item's outline by SAM 3.1.
- **Demo food photos** are cut out the same way by `npm run fetch-art`.

When none of those has a picture of a dish or drink, Muse Image pictures it in live mode. The demo food photos in `demo-art/` were made this way, and the app labels them as made with Muse Image.

Each sticker credits where its artwork came from. Third-party artwork is fetched at runtime, or into `art/` with `npm run fetch-art` for a static demo. It is never committed. Spotify, Audible, Kindle and Goodreads have no keyless public API for artwork, so they are not used.

Measured on October 26, 2026:

| Call | Model | Typical time | Typical cost |
|---|---|---|---|
| Identify a search | Muse Spark | 2 to 4 s | about $0.004 |
| Identify a photo | Muse Spark | about 3 s | about $0.0045 |
| Cut out a photo | SAM 3.1 | about 1 s | $0.0025 |
| Picture a dish | Muse Image | about 9 s | $0.01 |
| Paint the day's card | Muse Image | about 11 s | $0.01 |

A day with four logs (two of them photos) and one card costs about $0.04.

Every call goes through a spend guard (`src/server/spend.ts`):
- it reserves the call's worst case before sending, at the published prices;
- it records the real cost from the returned usage in a ledger;
- it refuses anything that would pass `CONSUMED_BUDGET_USD`;
- it halts all calls on any billing error.

A per-visitor hourly allowance keeps a public deployment from draining the budget.

## Make it feel like a toy

- **A welcome, one question at a time.** Each answer collapses into a ticked line, a ring counts the steps, the line beside it changes with each step, and it ends with a thank you that types itself out.

- **Depth cards.** A friend's three things sit on one card that looks like a thick piece of glass: the picture stacked in translucent layers. Each tap tilts it in 3D, fans the layers apart, and turns to the next thing with its own sound. Tonight's Consumed card turns the same way when you tap it.
- **Pop Poster stickers.** Every sticker, photo or cover, gets a white edge, a thick ring in its own color and a hard ink shadow, like a screen print. The shareable card is a green poster of your day's stickers, big and overlapping; tap it to turn it over to Muse Image's painting of the same day. You share whichever side is up.
- **Everything is a sticker.** Drag to move, twist with two fingers to turn and resize. On a computer, scroll to turn, or use the arrow keys and `[` `]`. A new sticker drops in with a wobble.
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
- search uses a small built-in catalog, and anything else still becomes a plain sticker;
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
- `scripts/fetch-art.ts`: gathers artwork for the demo catalog.
- `src/server/spend.ts`: the spend guard and ledger.
- `src/server/index.ts`: the API and static server.
- `src/shared/catalog.ts`: the demo catalog.
- `src/web/stickers.ts`: sticker art, drawn as SVG from a shape and three colors, and photo cutouts.
- `src/web/main.ts`: the app (Today, Friends, Tonight, the log sheet).
- `src/web/card.ts`: the 1080 by 1920 share card.
- `src/web/sound.ts`, `src/web/sfx/`: the sounds, made with ElevenLabs sound effects.

## License

MIT
