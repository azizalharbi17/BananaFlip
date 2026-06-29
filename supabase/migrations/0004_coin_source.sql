-- BananaFlip: per-coin data source.
-- Existing rows backfill to 'binance' (Binance klines / coinpaprika);
-- pinned CoinGecko coins like $ANSEM are upserted with source='coingecko'.
-- Paste this into the Supabase SQL editor.

alter table public.coins
  add column if not exists source text not null default 'binance';

alter table public.coins
  add column if not exists coingecko_id text;
