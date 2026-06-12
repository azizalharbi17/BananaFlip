# 🍌 BananaFlip

**Can it flip?** A crypto market-cap comparison tool. Pick two coins —
BananaFlip shows Coin A's price at Coin B's market cap, and how many ×'s
away the flip is.

```
impliedPrice = priceA × (mcapB / mcapA)
```

## Stack

- [Next.js 14](https://nextjs.org) (App Router) · React 18 · TypeScript
- Tailwind CSS (design tokens in [tailwind.config.ts](tailwind.config.ts),
  mirrored as CSS variables in [app/globals.css](app/globals.css))
- Fonts via `next/font`: Space Grotesk (display), Inter (body), JetBrains Mono (data)
- Supabase (Postgres) for live coin data, refreshed from coinpaprika by cron
- Deploys to Vercel as-is

## Development

```bash
cp .env.local.example .env.local   # fill in Supabase credentials
npm install
npm run dev    # http://localhost:3000
npm run build  # production build (also runs lint + type checks)
```

Without credentials the site runs entirely on the bundled demo seed and
shows the **DEMO DATA** pill — handy for offline work.

## Live data pipeline

```
coinpaprika /v1/tickers ──(every 10 min)──▶ POST /api/refresh ──▶ Supabase `coins`
                                                                      │
                getCoins() · 60s cache · demo fallback ◀──────────────┘
                  │
                  ├── pages (ISR, revalidate 60)
                  └── /api/search · /api/coin/:slug · /api/compare
```

1. **Schema** — run [supabase/migrations/0001_create_coins.sql](supabase/migrations/0001_create_coins.sql)
   in the Supabase SQL editor once.
2. **Refresh** — `POST /api/refresh` with `Authorization: Bearer $CRON_SECRET`
   pulls tickers (rank 1–2000, positive market cap), assigns slugs, and
   batch-upserts in chunks of 500. Returns `{updated, skipped, ms}`.
   [.github/workflows/refresh.yml](.github/workflows/refresh.yml) calls it
   every 10 minutes (requires a `CRON_SECRET` repo secret; also supports
   manual `workflow_dispatch`).
3. **Reads** — `getCoins()` in [lib/coins.ts](lib/coins.ts) is the single
   data-access point: Supabase, cached 60 s (busted immediately by the
   refresh via `revalidateTag`). If Supabase is unconfigured, unreachable,
   or empty, it serves [data/coins.json](data/coins.json) and flags
   `isDemoData` — the demo pill comes back and the site never breaks.

### Slugs

URL slugs are the clean lowercase symbol (`btc`, `pepe`). On symbol
collisions the lowest-rank coin keeps the clean slug; later coins get
`symbol-name`. Slugs are assigned on first sight and **never change across
refreshes**, and the 24 original demo slugs are preserved. Slugs never
contain `-flip-` (the pair-URL separator), so `/a-flip-b` parses
unambiguously.

### Colors

The 24 demo coins keep their hand-picked disc colors; every other coin gets
a stable mid-tone color hashed from its symbol ([lib/colors.ts](lib/colors.ts)).

## Environment

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL (server-side only) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (server-side only) |
| `CRON_SECRET` | Bearer token guarding `/api/refresh` |
| `CRYPTOCOMPARE_API_KEY` | Free CoinDesk-data key for ROI price history |
| `NEXT_PUBLIC_SITE_URL` | Optional canonical origin for metadata/sitemap |

## Internal API

| Route | Returns |
| --- | --- |
| `GET /api/search?q=do` | Coins matching name/symbol, best rank first (limit 20) |
| `GET /api/coin/:slug` | One coin with its market-cap rank |
| `GET /api/compare?challenger=pepe&target=doge` | Implied price, multiplier, cap gap, already-flipped flag |
| `GET /api/history?symbol=BTC[&year=2017]` | Year range (first→last) or that year's first close, or `{available:false}` |
| `GET/POST /api/refresh` | Cron-only data refresh (bearer auth) |

### NOW / ATH toggle

The verdict panel can compare against Coin B's **all-time-high** market cap
(`ath_price × circulating_supply`; `ath_price` comes from the refresh and
needs [supabase/migrations/0002_add_ath_price.sql](supabase/migrations/0002_add_ath_price.sql)).
The toggle hides for pairs where Coin B has no ATH data.

### ROI time machine

Entry is the first daily close of a selected **month + year**, from
CryptoCompare's full history (`/api/history?symbol=` returns one rich
per-coin payload — monthly first closes, yearly high/low, post-entry
tops and the daily series). Payloads are persisted in the Supabase
`coin_history` table (migration 0003) and cached in memory: the
upstream is hit once per coin plus a daily top-up, surviving deploys —
essential on the free key's ~100 calls/month. A stale stored payload
keeps serving whenever the upstream refresh fails. Month/year options adapt to each
coin's first available data. The result shows a WORST TIMING / YOUR
ENTRY / BEST TIMING spread (bought the year's top / your month / the
year's low), a STILL HOLDING vs SOLD THE TOP exit toggle (sell at the
highest close after entry), and preset scenario chips (BTC 2013 …
PEPE 2023). Requires `CRYPTOCOMPARE_API_KEY` (free at
developers.coindesk.com — the keyless tier was retired); without it, or
for coins CryptoCompare doesn't track, the calculator shows
*historical data unavailable for this range*. Demo mode synthesizes the
same shapes from seeded figures, labeled as such.

### Moon math

Target-mode arithmetic — no predictions: amount, coin, target chips or a
custom target, and a 1–30 year horizon. Shows the required multiple,
required price, implied market cap with reality anchors (live BTC/ETH
caps from our DB, approximate gold/Apple constants), and required vs
historical compound pace (the latter from the same cached history fetch
the ROI uses; "since launch" when the coin is younger than the horizon).

### Coin logos

Pickers and the hot-flips table show coinpaprika logos
(`static.coinpaprika.com/coin/{id}/logo.png`), falling back to the
colored monogram disc on load errors and in demo mode.

## Shareable flip pages

Every comparison has a canonical URL: **`/<coinA>-flip-<coinB>`**
(the API keeps `challenger`/`target` as its query-param names).
Hot pairs and the top-10 permutations are statically generated; any other
valid pair renders on first request and is cached (ISR, 60 s). Each page
gets its own `<title>`, meta description, canonical and OpenGraph tags.
The sitemap lists the hot pairs plus top-40 × top-8 targets (≤600 URLs),
regenerated hourly.

## Design

[design-reference.html](design-reference.html) is the approved design and the
source of truth. The CSS in `app/globals.css` is a 1:1 port of its stylesheet;
components reproduce its markup, animations (card flip, verdict count-up) and
breakpoint behavior, and respect `prefers-reduced-motion`.

## Disclaimer

Market data by coinpaprika. The ROI time machine uses synthetic historical
figures and is labeled accordingly. Not financial advice.
