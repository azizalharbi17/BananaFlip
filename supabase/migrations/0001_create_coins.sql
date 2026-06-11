-- BananaFlip: live coin data table.
-- Paste this into the Supabase SQL editor (or run via supabase db push).

create table if not exists public.coins (
  id text primary key,                  -- provider id (coinpaprika), e.g. "btc-bitcoin"
  slug text unique not null,            -- URL key, e.g. "btc" (stable across refreshes)
  symbol text not null,
  name text not null,
  rank int not null,
  price numeric not null,
  market_cap numeric not null,
  circulating_supply numeric,
  color text not null,                  -- disc background, hex
  updated_at timestamptz not null default now()
);

create index if not exists coins_rank_idx on public.coins (rank);
-- slug is also covered by the unique constraint's index; this explicit one
-- is kept to match the requested schema and is harmless if redundant.
create index if not exists coins_slug_idx on public.coins (slug);

-- The app only ever talks to this table with the service-role key.
-- Locking RLS down (no policies) keeps anon/authenticated clients out.
alter table public.coins enable row level security;
