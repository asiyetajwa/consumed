# Consumed

**Spotify Wrapped, but every day, and for everything you consume.**

Consumed is one daily page of what you listened to, read and ate. You log something in seconds, by photo or by search, and it lands on today's page as a glossy sticker you can drag and twist. Your friends' days sit in one feed, with matches when two of you are on the same book or song. At night your day seals into a capsule that cracks open as one card, ready for Instagram Stories or WhatsApp.

Built for the Meta Global AI Developer Hackathon (Startup track, theme "Build for Your World").

## How it uses the Meta Model API

| Model | Where | What it does |
|---|---|---|
| **Muse Spark** (`muse-spark-1.3`) | Logging | Reads a photo (an album, a book cover, a plate) or a search, and returns the item as JSON through structured output: the real title and creator, a short line of facts, one warm note, the sticker shape and three colors from the photo, a color word for dares, and the box around the main subject so the photo itself becomes a die-cut sticker. Reasoning effort is set to low to keep each log fast and cheap. |
| **Muse Image** (`muse-image-1.0`) | Tonight | Paints the day's items as one illustration for the Consumed card, from short visual descriptions Muse Spark wrote at log time. Web search, image search and the shell tool are turned off, and the prompt asks for no text or logos. |

Every call goes through a spend guard (`src/server/spend.ts`):
- it reserves the call's worst case before sending, at the published prices;
- it records the real cost from the returned usage in a ledger;
- it refuses anything that would pass `CONSUMED_BUDGET_USD`;
- it halts all calls on any billing error.

A per-visitor hourly allowance keeps a public deployment from draining the budget.

## Make it feel like a toy

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

Your log stays in your browser. The friends in the feed are sample friends.

## Layout

- `src/server/meta.ts`: the two Meta Model API calls, the JSON schema and the card prompt.
- `src/server/spend.ts`: the spend guard and ledger.
- `src/server/index.ts`: the API and static server.
- `src/shared/catalog.ts`: the demo catalog.
- `src/web/stickers.ts`: sticker art, drawn as SVG from a shape and three colors, and photo cutouts.
- `src/web/main.ts`: the app (Today, Friends, Tonight, the log sheet).
- `src/web/card.ts`: the 1080 by 1920 share card.
- `src/web/sound.ts`, `src/web/sfx/`: the sounds, made with ElevenLabs sound effects.

## License

MIT
