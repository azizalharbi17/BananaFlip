# 🍌 BananaFlip

**Can it flip?** A crypto market-cap comparison tool. Pick a challenger and a
target coin — BananaFlip shows the challenger's price at the target's market
cap, and how many ×'s away the flippening is.

```
impliedPrice = priceA × (mcapB / mcapA)
```

> ⚠️ Currently running on **demo data** (see the pill in the nav). All numbers
> are mock figures from the design prototype.

## Stack

- [Next.js 14](https://nextjs.org) (App Router) · React 18 · TypeScript
- Tailwind CSS (design tokens in [tailwind.config.ts](tailwind.config.ts),
  mirrored as CSS variables in [app/globals.css](app/globals.css))
- Fonts via `next/font`: Space Grotesk (display), Inter (body), JetBrains Mono (data)
- Zero runtime dependencies beyond Next/React; deploys to Vercel as-is

## Development

```bash
npm install
npm run dev    # http://localhost:3000
npm run build  # production build (also runs lint + type checks)
```

## Architecture

### Data flows through one module

All coin data is read through **`getCoins()`** in [lib/coins.ts](lib/coins.ts),
which currently serves the demo seed in [data/coins.json](data/coins.json).
To go live, swap the body of `getCoins()` for a read from a real store
(e.g. a cron job writing CoinGecko snapshots to Supabase). Every consumer —
API routes, pages, sitemap — goes through this function, so nothing else
changes. The frontend never calls third-party APIs.

### Internal API

| Route | Returns |
| --- | --- |
| `GET /api/search?q=do` | Coins matching name/symbol, ranked by market cap |
| `GET /api/coin/:id` | One coin with its market-cap rank |
| `GET /api/compare?challenger=pepe&target=doge` | Implied price, multiplier, cap gap, already-flipped flag |

### Shareable flip pages

Every comparison has a canonical URL: **`/<challenger>-flip-<target>`**
(e.g. [`/pepe-flip-doge`](https://bananaflip.vercel.app/pepe-flip-doge)).
The hot pairs and all top-8 permutations are statically generated at build
time; any other valid pair is rendered on first request and cached. Each page
gets its own `<title>`, meta description, canonical link and OpenGraph tags,
and all 552 pairs are listed in `sitemap.xml`. As you change coins in the UI,
the address bar follows along via `history.replaceState`.

### Design

[design-reference.html](design-reference.html) is the approved design and the
source of truth. The CSS in `app/globals.css` is a 1:1 port of its stylesheet;
components reproduce its markup, animations (card flip, verdict count-up) and
breakpoint behavior, and respect `prefers-reduced-motion`.

## Disclaimer

Demo figures · prototype only · not financial advice.
