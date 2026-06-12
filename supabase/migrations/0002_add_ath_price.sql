-- BananaFlip: all-time-high price for the NOW/ATH verdict toggle.
-- Paste this into the Supabase SQL editor.

alter table public.coins add column if not exists ath_price numeric;
