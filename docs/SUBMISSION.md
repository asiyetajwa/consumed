# Consumed: Devpost submission

Meta Global AI Developer Hackathon, Startup track, theme "Build for Your World".
Deadline: November 5, 2026, 02:00 UTC.

## Fields

**Name:** Consumed

**Tagline:** Spotify Wrapped, but every day, and for everything you consume.

**Built with:** Muse Spark, Muse Image, SAM 3.1, Meta Model API, TypeScript, Node.js, Express, HTML Canvas, Web Animations API, ElevenLabs (sound effects, film voiceover and music), Remotion (film)

**Repo:** https://github.com/asiyetajwa/consumed (public, MIT)

**Video:** https://youtu.be/xpzTUJv_nhA (public on YouTube, 1:52). The source file is `film/out/ConsumedLandscape.mp4`.

**Thumbnails:** `docs/thumbnail.jpg` (3:2, Devpost) and `docs/thumbnail-youtube.jpg` (16:9).

## Description

### Inspiration

What we listen to, read and eat is a big part of who we are, and it is scattered across five apps. The best of it rarely gets shared while it is fresh. By the time Wrapped comes around in December it is a statistic, not a moment. Friends already swap recommendations in group chats and stories one day at a time. We wanted one place for that day, made to share.

The look came from the illustrated food on the new US food pyramid at realfood.gov: real food, hand-painted, sitting straight on cream paper. We wanted everything you consume to look like that.

### What it does

Consumed is one page a day for everything you listen to, read and eat.

- **Log in seconds.** Type a song or a book, or snap your plate. Muse Spark identifies it and writes one warm line about it.
- **Everything is hand-painted.** Muse Image repaints each item in a gouache and colored-pencil style. Your bowl of pho comes back as a painting of your bowl of pho. A song comes back as its real album cover painted on a record sleeve, and a book as its real cover on a standing hardcover. It drops onto today's page with a pop and its own sound: a chime for music, rustling paper for books, a chew for food.
- **Friends, one feed.** Each friend's day is a card that turns in 3D to the next thing they enjoyed. When two of you are on the same book or song, a match appears. There are reactions, a daily taste dare ("eat something purple today") that completes itself, and a paper-chain streak that simply waits when you miss a day.
- **Tonight, one card.** At night your day seals into a capsule. Crack it open and your day is one poster: a big black title and your paintings piled into an upside-down pyramid. Tap it and it turns over to Muse Image's painting of your whole day. Share either side to Instagram Stories or WhatsApp.

### How we built it

A TypeScript web app (mobile first) and a small Node server that calls the Meta Model API.

- **Muse Spark** reads a photo or a search and returns the item as structured JSON: the real title and creator, a line of facts, a warm note, colors, a color word for dares, a noun for the object and a box around it. Reasoning effort is low, so a log takes 2 to 4 seconds and costs about $0.004.
- **SAM 3.1** lifts the dish off the table, from Muse Spark's noun, so Muse Image is handed the dish alone. It runs again on the finished painting, so a white bowl on cream paper keeps its rim.
- **Muse Image** repaints each item through the image edit endpoint (about 10 seconds, $0.01), and paints the day for the back of the card.
- **The real covers** come from free public catalogs: Apple's iTunes Search API, Open Library and TheMealDB.
- **The browser lifts each painting off its paper.** It floods the paper in from the edges, keeps the painting's soft shadow as translucent grey, and uses SAM's mask to protect the dish.
- **Until a painting arrives,** the real photo or cover shows, and you can stick it right away; it turns into the painting when it is ready.
- **Every call goes through a spend guard.** It reserves the worst case, records the real cost in a ledger, refuses anything past a hard budget, and halts on any billing error. A per-visitor hourly allowance protects a public deployment.

A whole day of new items, repainted, with the card costs about 9 cents. The demo catalog of 31 songs, books and dishes was painted once ahead of time, so searching it costs only the identify call.

### Challenges we ran into

- **Lifting a painting off cream paper.** A white bowl rim is the same color as the paper, and a hairline gap in a pencil outline lets a flood fill pour into the dish. We shrink the paper before flooding so narrow gaps cannot carry it, and let SAM 3.1's mask of the painted dish overrule the paper.
- **Request limits.** Muse Image's edit endpoint refused our first, larger requests, so the browser sends a 640 pixel JPEG.
- **Content filters.** Muse Image declined to repaint one album cover. The app falls back to the real cover, and we swapped that song out of the demo catalog.
- **Waiting for a model.** A painting takes about 10 seconds, so the app never makes you wait for it: you can stick the item at once and it repaints itself in place.

### Accomplishments that we're proud of

- A real photo of your dinner comes back as a painting of that dinner, in about 10 seconds, for about a cent.
- The whole demo film is the live app on the Meta Model API, with no mock screens.
- A day costs cents, and the spend guard makes a runaway bill impossible.

### What we learned

Pairing models beats asking one model for everything. Muse Spark names the object, SAM 3.1 finds exactly that object, and Muse Image keeps its identity while changing its style. Each model is good at a narrow job, and the noun Muse Spark writes is what ties them together.

### What's next for Consumed

- Real friend graphs, and invites by link.
- Movies and TV as a fourth category.
- A weekly and yearly Wrapped built from the daily pages.
- An installable app with the camera one tap from the home screen.

## Product feedback (Muse Spark, Muse Image, SAM 3.1, Meta Model API)

- **Muse Spark structured output was the backbone.** The JSON schema held on every call, and low reasoning effort kept identify calls at 2 to 4 seconds for about $0.004. Asking for a short noun phrase ("bowl of pho") gave us a perfect prompt for SAM 3.1.
- **Muse Image edits keep identity remarkably well.** The bowl, garnish and arrangement of a real photo survive a full style change, and album and book covers stay recognizable when painted on objects. This is what made the product possible.
- **Muse Image edits: a few rough edges.**
  - Our first requests (photos over 1,000 pixels, with `output_format` set to PNG) were refused as `model_not_found` rather than with an error naming the problem, which cost us debugging time. A 640 pixel JPEG with no output format works every time. A clear error and a documented size limit would help.
  - Edits come back as WebP when no format is asked for; the docs could say so.
  - Edits always come back on a background. A transparent-background option, or an "isolate the subject" flag, would remove the work of lifting the painting off its paper.
- **Content filtering on edits** declined one well-known album cover with a generic `content_policy_violation` and no detail on what triggered it, so we could not adjust the prompt. A reason category would help.
- **SAM 3.1 with a noun prompt** was excellent at finding the one object a photo is about, including on paintings. The streamed one-bit masks and the `@meta-sam/parser` package made it easy to use.
- **Billing and limits** were clear, and the credit made it easy to experiment within a hard budget.

## Spend

- Meta Model API spend for the whole build, from the ledger: about $1.60 of the hackathon credit. That covers development, testing, painting the catalog, and recording the film.
- $0 on any card.

## Points to keep straight

- The friends in the feed are sample friends with invented, painted profile pictures. The app says so in its settings.
- Third-party covers are fetched from public APIs at runtime and are never committed to the repo. Each painting credits its source.
- Demo food photos were made with Muse Image and are labeled as demo photos.
