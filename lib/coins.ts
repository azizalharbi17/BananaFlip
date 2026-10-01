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
  "id,slug,symbol,name,rank,price,market_cap,circulating_supply,ath_price,color,logo,source,coingecko_id";
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
  logo: string | null;
  source: string | null;
  coingecko_id: string | null;
}

function toSource(s: string | null): "binance" | "coingecko" | "dexscreener" {
  return s === "coingecko" || s === "dexscreener" ? s : "binance";
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
    logo: row.logo ?? null,
    source: toSource(row.source),
    coingeckoId: row.coingecko_id ?? null,
    // Chain is encoded in the resolved-token id ("dex-<chain>-<addr>"),
    // so no dedicated column is needed to satisfy "store the chain".
    chain: row.id.startsWith("dex-") ? row.id.split("-")[1] ?? null : null,
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
  logo?: string;
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
    logo: c.logo ?? null,
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

/** Upper bound on the trending set (the cron caps it lower). */
const MAX_TRENDING = 30;

/**
 * The auto-discovered trending set (Hot Flips), hottest first. Its own
 * query on purpose: trending memecoins usually rank far outside the
 * top-2000 window, and the main list / picker must not absorb them.
 * Empty when Supabase is unconfigured, the cron hasn't run yet, or the
 * trending columns (migration 0006) don't exist — the page then falls
 * back to the curated HOT_PAIRS, never a blank section.
 */
async function fetchTrending(): Promise<RankedCoin[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("coins")
      .select(`${DB_COLUMNS},trending_rank`)
      .eq("is_trending", true)
      .order("trending_rank", { ascending: true })
      .limit(MAX_TRENDING);
    if (error || !data) return [];
    return (data as (CoinRow & { trending_rank: number | null })[]).map((row) => ({
      ...rowToCoin(row),
      trendingRank: row.trending_rank ?? null,
    }));
  } catch {
    return [];
  }
}

/** Cached 60s; the trending cron busts it via revalidateTag("coins"). */
export const getTrendingCoins = unstable_cache(fetchTrending, ["trending-coins"], {
  revalidate: 60,
  tags: ["coins"],
});

export async function getRankedCoins(): Promise<RankedCoin[]> {
  return (await getCoins()).coins;
}

export async function getCoinBySlug(slug: string): Promise<RankedCoin | undefined> {
  const key = slug.toLowerCase();
  const { coins } = await getCoins();
  const inWindow = coins.find((c) => c.slug === key);
  if (inWindow) return inWindow;

  // On-demand resolved tokens (source="dexscreener") can rank far beyond
  // the cached top-2000 window, so look them up directly by slug. Keeps
  // compare / coin / shareable pair pages working for the long tail.
  const supabase = getSupabase();
  if (!supabase) return undefined;
  try {
    const { data, error } = await supabase
      .from("coins")
      .select(DB_COLUMNS)
      .eq("slug", key)
      .maybeSingle();
    if (error || !data) return undefined;
    return rowToCoin(data as CoinRow);
  } catch {
    return undefined;
  }
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
