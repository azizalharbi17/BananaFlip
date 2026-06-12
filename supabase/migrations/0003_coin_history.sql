-- BananaFlip: persisted per-coin price-history payloads.
-- CryptoCompare's free tier allows ~100 calls/month; the in-memory cache
-- resets on every deploy/restart, so histories are stored here and the
-- upstream is hit once per coin (plus a daily refresh) instead.
-- Paste this into the Supabase SQL editor.

create table if not exists public.coin_history (
  symbol text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

-- Service-role access only, same posture as public.coins.
alter table public.coin_history enable row level security;
