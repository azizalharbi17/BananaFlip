-- BananaFlip: auto-discovered trending tokens (the Hot Flips set).
-- /api/cron/trending (Vercel Cron) finds what's trending on-chain via
-- GeckoTerminal, resolves each token through the DexScreener resolver
-- (source='dexscreener' rows, self-hosted logo) and flags the current
-- set here. Every run REPLACES the set: previous flags are cleared, the
-- rows themselves stay (still searchable / flippable).
-- Paste this into the Supabase SQL editor.

alter table public.coins
  add column if not exists is_trending boolean not null default false;

alter table public.coins
  add column if not exists trending_rank int;

alter table public.coins
  add column if not exists trending_at timestamptz;

-- Hot Flips reads "where is_trending order by trending_rank" — a tiny
-- partial index instead of scanning ~2000 rows on every render.
create index if not exists coins_trending_rank_idx
  on public.coins (trending_rank)
  where is_trending;
