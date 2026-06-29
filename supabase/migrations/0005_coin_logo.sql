-- BananaFlip: stored logo URL for coins that don't follow the coinpaprika
-- id→CDN convention (e.g. CoinGecko-sourced $ANSEM). Binance/coinpaprika
-- coins leave this null and keep deriving the logo from their id.
-- Paste this into the Supabase SQL editor.

alter table public.coins add column if not exists logo text;
