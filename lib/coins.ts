import { unstable_cache } from "next/cache";
import seed from "@/data/coins.json";
import { getSupabase } from "./supabase";
import type { CoinDataset, RankedCoin } from "./types";

/**
 * Single data-access point for coin data. Server-side only (API routes,
 * server components, sitemap) — the client talks to /api/* instead.
 *
 * Source of truth is the Supabase `coins` table, kept fresh by
 * /api/refresh (cron). Reads are cached for 60 seconds. If Supabase is
 * unconfigured, unreachable, or empty, the bundled demo seed in
 * data/coins.json is served instead and `isDemoData` is set — the site
 * never breaks because the data layer is down.
 */

const DB_COLUMNS =
  "id,slug,symbol,name,rank,price,market_cap,circulating_supply,ath_price,color,source,coingecko_id";
/** PostgREST caps responses at 1000 rows, so reads are paged. */
const DB_PAGE = 1000;
const MAX_COINS = 2000;

interface CoinRow {
  id: string;
  slug: string;
  symbol: string;
  name: string;
  rank: number;
  price: number | string;
  market_cap: number | string;
  circulating_supply: number | string | null;
  ath_price: number | string | null;
  color: string;
  source: string | null;
  coingecko_id: string | null;
}

function rowToCoin(row: CoinRow): RankedCoin {
  return {
    id: row.id,
    slug: row.slug,
    symbol: row.symbol,
    name: row.name,
    rank: row.rank,
    price: Number(row.price),
    marketCap: Number(row.market_cap),
    circulatingSupply:
      row.circulating_supply == null ? null : Number(row.circulating_supply),
    athPrice: row.ath_price == null ? null : Number(row.ath_price),
    color: row.color,
    source: row.source === "coingecko" ? "coingecko" : "binance",
    coingeckoId: row.coingecko_id ?? null,
  };
}

interface SeedCoin {
  id: string;
  name: string;
  symbol: string;
  price: number;
  marketCap: number;
  athPrice?: number;
  color: string;
  source?: string;
  coingeckoId?: string;
}

/**
 * The bundled demo seed, ranked by market cap (slug doubles as id).
 * Circulating supply is implied by marketCap/price, keeping the demo
 * ATH math consistent with the live formula.
 */
const DEMO_COINS: RankedCoin[] = (seed.coins as SeedCoin[])
  .slice()
  .sort((a, b) => b.marketCap - a.marketCap)
  .map((c, i) => ({
    id: c.id,
    slug: c.id,
    symbol: c.symbol,
    name: c.name,
    price: c.price,
    marketCap: c.marketCap,
    athPrice: c.athPrice ?? null,
    circulatingSupply: c.marketCap / c.price,
    color: c.color,
    rank: i + 1,
    source: c.source === "coingecko" ? "coingecko" : "binance",
    coingeckoId: c.coingeckoId ?? null,
  }));

const demoDataset = (): CoinDataset => ({ coins: DEMO_COINS, isDemoData: true });

async function fetchDataset(): Promise<CoinDataset> {
  const supabase = getSupabase();
  if (!supabase) return demoDataset();
  try {
    const rows: CoinRow[] = [];
    for (let from = 0; rows.length < MAX_COINS; from += DB_PAGE) {
      const { data, error } = await supabase
        .from("coins")
        .select(DB_COLUMNS)
        .order("rank", { ascending: true })
        .range(from, from + DB_PAGE - 1);
      if (error) throw error;
      rows.push(...(data as CoinRow[]));
      if (!data || data.length < DB_PAGE) break;
    }
    if (rows.length === 0) return demoDataset();
    return { coins: rows.slice(0, MAX_COINS).map(rowToCoin), isDemoData: false };
  } catch {
    return demoDataset();
  }
}

/** Cached 60s; the refresh route busts it via revalidateTag("coins"). */
export const getCoins = unstable_cache(fetchDataset, ["coins-dataset"], {
  revalidate: 60,
  tags: ["coins"],
});

export async function getRankedCoins(): Promise<RankedCoin[]> {
  return (await getCoins()).coins;
}

export async function getCoinBySlug(slug: string): Promise<RankedCoin | undefined> {
  const { coins } = await getCoins();
  return coins.find((c) => c.slug === slug.toLowerCase());
}

/**
 * Autocomplete search: name or symbol match, best rank first. Queries
 * Supabase directly; falls back to filtering the cached dataset (which
 * itself may already be the demo seed) when the query fails.
 */
export async function searchCoins(query: string, limit = 20): Promise<RankedCoin[]> {
  const q = query.trim();
  if (!q) return (await getRankedCoins()).slice(0, limit);

  const supabase = getSupabase();
  if (supabase) {
    try {
      // Strip PostgREST syntax characters before building the or() filter.
      const safe = q.replace(/[^a-zA-Z0-9 $._-]/g, "");
      if (safe) {
        const pattern = `%${safe}%`;
        const { data, error } = await supabase
          .from("coins")
          .select(DB_COLUMNS)
          .or(`name.ilike.${pattern},symbol.ilike.${pattern}`)
          .order("rank", { ascending: true })
          .limit(limit);
        if (!error && data) return (data as CoinRow[]).map(rowToCoin);
      }
    } catch {
      /* fall through to the cached dataset */
    }
  }

  const lower = q.toLowerCase();
  const { coins } = await getCoins();
  return coins
    .filter(
      (c) =>
        c.name.toLowerCase().includes(lower) || c.symbol.toLowerCase().includes(lower)
    )
    .slice(0, limit);
}
