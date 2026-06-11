# 🍌 BananaFlip

**The flippening, calculated.** Pick two coins and BananaFlip tells you what the
challenger would cost if it had the top banana's market cap — plus the
multiplier standing in the way.

```
hypothetical price = priceA × (mcapB ÷ mcapA)
```

Built with **Next.js 14 (App Router)** and **Tailwind CSS**. No third-party
calls from the browser — everything is served from BananaFlip's own cached
coin table.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (pre-renders trending flip pages)
npm start
```

## Features

- **Flip comparator** — token autocomplete (keyboard-friendly combobox), the
  hypothetical price with an animated count-up, the multiplier verdict, and a
  √-scaled market-cap gap chart.
- **The Flip button** — swaps challenger and target with a springy 180° spin,
  a card flip and a burst of banana particles. Flipping is the brand; the
  button earns its name.
- **Trending flips** — curated matchups, server-rendered as crawlable cards.
- **Shareable SEO pages** — every pair gets a permanent URL like
  [`/pepe-flip-dogecoin`](http://localhost:3000/pepe-flip-dogecoin). Curated
  pairs are pre-rendered at build time (`generateStaticParams`), any other
  pair renders on demand and is cached (ISR, `revalidate = 300`). Each page
  ships a server-rendered verdict paragraph, canonical/OG metadata and a
  **generated per-flip OG image**.
- **ROI Machine** (`/roi`) — "if you invested $X in coin Y on date Z" with a
  portfolio sparkline, holdings breakdown and an appropriately judgmental
  verdict line.
- **Mobile-first** — the comparator stacks vertically with the flip button
  between the slots; everything reflows from 320px up.

## Architecture & the data swap

The frontend never calls third-party APIs. The dependency chain is:

```
UI / pages ──► internal API routes ──► in-memory store ──► CoinProvider
                                            ▲                   │
                                  /api/cron/refresh        seed JSON (now)
                                                           live vendor (later)
```

- `src/data/seed-coins.json` — mock snapshot of 50 coins (name, symbol, logo,
  price, market cap, 24h change, listing date).
- `src/lib/provider.ts` — the **`CoinProvider` interface** is the only place
  that knows where data comes from. Today it's `SeedProvider`; swapping in a
  real vendor means implementing one class (a `CoinGeckoProvider` sketch is
  included) and flipping the `COIN_PROVIDER` env var.
- `src/lib/store.ts` — TTL-cached coin table consumed by every route and
  server component, with rank-aware fuzzy search.
- `src/app/api/` — `search`, `coin/[id]`, `compare`, `roi`, plus
  `cron/refresh` (Bearer-protected via `CRON_SECRET`) ready to be pointed at
  a scheduler once the live provider lands.
- `src/lib/history.ts` — the ROI calculator needs daily history the snapshot
  doesn't have, so it generates a **deterministic** geometric random walk per
  coin (seeded from the coin id, volatility scaled by rank/meme-ness, walked
  backwards from the real spot price so "today" always matches). Same input →
  same series on every server. This module is the swap point for real
  `market_chart` data; the `/api/roi` contract doesn't change.
- `public/logos/` — generated monogram logos (`npm run generate:logos`), so
  no assets are hotlinked.

## Design notes — why it looks like this

The brief said *don't* do the generic dark crypto dashboard, so BananaFlip is
the opposite: **a fruit stand that takes math seriously.**

- **Direction: "fruit-stand finance."** Warm cream paper with a subtle
  dot-grain, thick near-black-brown ink borders, hard offset shadows and
  sticker-style chips — part neo-brutalist web, part grocery price tag. It
  reads as playful at arm's length but every number is set in tabular mono
  with honest labels, which is what keeps it credible as a tool.
- **Palette.** `banana #FFD23F` (action, highlights), `cream #FBF4E2` (paper),
  `ink #231A0E` (a brown-black, like a peel gone dark — softer than pure
  black), `leaf` green for gains and `bruise` red for losses. Up/down colors
  are reserved strictly for semantics so the yellow never lies to you.
- **Type.** *Bricolage Grotesque* for display (chunky, slightly fruity
  without being a joke font), *Space Grotesk* for body, *IBM Plex Mono* with
  `tabular-nums` for every figure — prices, caps and multipliers align like a
  ledger.
- **Logo.** A coin whose embossed face is a banana bent into a rotation arc
  with an arrowhead tip: banana + coin + flip in one glyph. It spins 180° on
  hover, because of course it does.
- **The flip, played with everywhere.** The swap button rotates with a
  springy overshoot and emits a banana-particle burst; the two coin slots
  replay a 3D card-flip; results pop in and the headline price rolls up;
  the wordmark's "Flip" sits on a tilted sticker. Everything respects
  `prefers-reduced-motion`.
- **Honest charts.** The market-cap gap uses a square-root scale (a 1000×
  underdog is invisible on a linear bar) and says so on the chart, with exact
  values printed beside each bar.
- **Microcopy with potassium.** "The challenger 🥊 vs the top banana 👑",
  404s that "slipped on a peel", ROI verdicts from "generational banana
  energy" to "full banana split". Finance sites forget to be fun; meme sites
  forget to be right. BananaFlip tries to be both.

## Disclaimer

Hypothetical arithmetic, not financial advice. Demo data is a static
snapshot; the ROI history is simulated until a live provider is wired in.
Bananas are not securities.
