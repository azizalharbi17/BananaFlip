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
- Supabase (Postgres + Storage) for live coin data, refreshed from coinpaprika by cron;
  trending memecoins auto-discovered from GeckoTerminal/DexScreener by Vercel Cron
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
| `CRON_SECRET` | Bearer token guarding `/api/refresh` and `/api/cron/trending` (Vercel Cron sends it automatically) |
| `TRENDING_MIN_LIQUIDITY_USD` / `TRENDING_MIN_VOLUME_USD` | Optional floors for trending tokens (default $100k each) |
| `TRENDING_LIMIT` / `TRENDING_NETWORKS` / `TRENDING_DURATION` / `TRENDING_CONCURRENCY` / `TRENDING_MAX_MCAP_USD` | Optional trending-cron knobs (defaults 15 / `solana,base,eth,bsc` / `24h` / 3 / $20B) |
| `CRYPTOCOMPARE_API_KEY` | Free CoinDesk-data key for ROI price history |
| `COINGECKO_API_KEY` | Optional CoinGecko demo key (headroom for pinned coins) |
| `NEXT_PUBLIC_SITE_URL` | Optional canonical origin for metadata/sitemap |

## Internal API

| Route | Returns |
| --- | --- |
| `GET /api/search?q=do` | Coins matching name/symbol, best rank first (limit 20) |
| `GET /api/coin/:slug` | One coin with its market-cap rank |
| `GET /api/compare?challenger=pepe&target=doge` | Implied price, multiplier, cap gap, already-flipped flag |
| `GET /api/history?symbol=BTC[&year=2017]` | Year range (first→last) or that year's first close, or `{available:false}` |
| `GET/POST /api/refresh` | Cron-only data refresh (bearer auth) |
| `GET /api/resolve?address=0x…` | Any on-chain token by contract (DexScreener), cached in `coins` with a self-hosted logo |
| `GET/POST /api/cron/trending` | Cron-only trending auto-discovery → the Hot Flips set (bearer auth) |

### Pinned CoinGecko coins

Most coins flow through coinpaprika (current values) and Binance (history).
Coins that aren't on Binance — e.g. the Solana Pump.fun token **$ANSEM**
("The Black Bull") — are pinned in [lib/pinned-coins.ts](lib/pinned-coins.ts)
by CoinGecko id + contract (never by ticker; copycats abound) with
`source = "coingecko"`. Their current values (circulating market cap —
**not** FDV — plus supply and ATH) are pulled from CoinGecko in the
refresh route and stored in the `coins` table; their history comes from
CoinGecko `market_chart` (capped to the listing date) through the same
`coin_history` read-through cache. Migration 0004 adds the `source` /
`coingecko_id` columns.

### Trending auto-discovery (Hot Flips)

New memecoins reach the site — and fill the **Hot Flips** table — without
anyone pasting contracts. `/api/cron/trending` runs every 2 hours on
[Vercel Cron](vercel.json) (tunable; daily is the floor — memecoins move
fast) and is guarded by `CRON_SECRET`, which Vercel sends as
`Authorization: Bearer …` on every scheduled call, so the public can't
trigger it. Hobby-plan projects are limited to daily crons: change the
schedule to `0 6 * * *` there.

```
GeckoTerminal trending pools ──▶ quality filters ──▶ DexScreener resolver ──▶ coins (source=dexscreener,
(/networks/trending_pools +         liq ≥ $100k        (same path as a           is_trending + trending_rank)
 solana / base / eth / bsc)         vol24h ≥ $100k      pasted contract:                │
                                    no stables/wrapped  price, marketCap/FDV,     getTrendingCoins() ──▶ Hot Flips, by rank
                                    not in curated list self-hosted logo)
```

1. **Discover** — [lib/trending.ts](lib/trending.ts) pulls GeckoTerminal's
   cross-network trending feed plus one per configured network (ranked by
   real volume/activity, not paid boosts) and merges them into one ranking:
   cross-network order first, then the per-network feeds interleaved so no
   chain crowds out the rest. One candidate per token, carrying its
   strongest pool's liquidity and 24 h volume.
2. **Filter** — liquidity *and* 24 h volume floors (env-configurable),
   stablecoins / wrapped natives / LSTs, and anything already in the curated
   list (top-500 coinpaprika coins + pinned coins: BTC or PEPE are never
   "trending"), plus a sanity cap on market cap.
3. **Resolve** — each survivor goes through the *existing* resolver in
   [lib/token-resolve.ts](lib/token-resolve.ts): DexScreener price and
   `marketCap` (FDV fallback — the same rule as pasted tokens; established
   coins keep circulating cap), the logo self-hosted into the `token-logos`
   bucket (served by `/api/token-logo/:id`), a `coins` row. The feed's own
   image is the fallback logo source. Anything without a price, cap or
   stored logo — or whose DexScreener top pair is under the floors, or on a
   different chain than the feed said — is skipped. At most 3 resolve in
   parallel (storage uploads share the Postgres pool), with upload retries.
4. **Store** — the top 15 are upserted with `is_trending = true` and
   `trending_rank`; the previous run's flags are cleared, so the set
   **reflects what's trending now** and never grows unbounded. Rows are never
   deleted: a coin that drops off the list stays searchable and flippable.
   Migration [0006](supabase/migrations/0006_coin_trending.sql) adds the
   columns.
5. **Show** — `getTrendingCoins()` (own query, 60 s cache, busted by the
   cron) feeds Hot Flips by rank; each trending coin targets the smallest
   rung of the BONK → WIF → FLOKI → PEPE → SHIB → DOGE → SOL → ETH → BTC
   ladder that is still bigger than it ([lib/hot-flips.ts](lib/hot-flips.ts)).
   The main list / picker ranking is untouched — trending is its own flagged
   set. Before the first run, in demo mode, or if the cron can't produce a
   set, the curated `HOT_PAIRS` show instead.

**Graceful failure:** if GeckoTerminal is down, returns nothing, or nothing
passes the filters/resolver, the run reports `kept: true` and leaves the
previous set untouched — Hot Flips never blanks out. Run it by hand with
`node scripts/run-trending-cron.mjs [origin]` (reads `CRON_SECRET` from
`.env.local`).

### NOW / ATH toggle

The verdict panel can compare against Coin B's **all-time-high** market cap
(`ath_price × circulating_supply`; `ath_price` comes from the refresh and
needs [supabase/migrations/0002_add_ath_price.sql](supabase/migrations/0002_add_ath_price.sql)).
The toggle hides for pairs where Coin B has no ATH data.

### ROI time machine

Entry is the first daily close of a selected **month + year**.
`/api/history?symbol=` returns one rich per-coin payload — monthly
first closes, yearly high/low, post-entry tops and the daily series.
Daily closes come from **Binance public klines** (the
`data-api.binance.vision` mirror — free, no key, no monthly cap, not
geo-blocked, full history back to each USDT pair's listing), falling
back to **CryptoCompare** only for coins Binance doesn't list (its free
key is ~100 calls/*month*, so it must stay off the common path).
Payloads are persisted in the Supabase `coin_history` table (migration
0003) and cached in memory, so the upstream is touched ~once per coin
plus a weekly top-up and survives deploys. A stale stored payload keeps
serving whenever an upstream refresh fails. Month/year options adapt to each
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

Pickers and the hot-flips table show coinpaprika logos (mirrored into our
Supabase Storage and served by `/api/logo/:id`), falling back to the
colored monogram disc on load errors and in demo mode. Resolved and
trending tokens carry a self-hosted copy of their DexScreener/GeckoTerminal
image (`/api/token-logo/:id`), so the browser never hotlinks a third-party CDN.

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
