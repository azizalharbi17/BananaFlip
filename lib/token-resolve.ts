import { colorForSymbol } from "./colors";
import { resolveToken } from "./dexscreener";
import { sanitizeSlugPart } from "./slugs";
import { getSupabase } from "./supabase";
import type { RankedCoin } from "./types";

/* Resolve a contract address into a full coin: live values from
   DexScreener, a self-hosted logo, and a row in the coins table so
   compare / pair pages / repeat loads all work. */

const BUCKET = "token-logos";
const MAX_LOGO_BYTES = 3_000_000;

function normalizeAddress(address: string): string {
  const a = address.trim();
  return /^0x[a-fA-F0-9]{40}$/.test(a) ? a.toLowerCase() : a; // EVM is case-insensitive
}

async function ensureBucket(
  supabase: NonNullable<ReturnType<typeof getSupabase>>
): Promise<void> {
  // Idempotent: errors ("already exists") are expected after the first run.
  await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {});
}

/**
 * Download the source logo once and store it in our Supabase bucket, so
 * the browser only ever hits our own domain (via /api/token-logo) — no
 * hotlinking a third-party CDN that flakes on re-render (the ANSEM bug).
 * Returns a same-origin path, or null if anything fails (→ monogram).
 */
async function selfHostLogo(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  id: string,
  imageUrl: string | null
): Promise<string | null> {
  if (!imageUrl) return null;
  try {
    const res = await fetch(imageUrl, { cache: "no-store" });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/png";
    if (!contentType.startsWith("image/")) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_LOGO_BYTES) return null;
    await ensureBucket(supabase);
    const up = await supabase.storage
      .from(BUCKET)
      .upload(id, bytes, { contentType, upsert: true });
    if (up.error) return null;
    return `/api/token-logo/${encodeURIComponent(id)}`;
  } catch {
    return null;
  }
}

/**
 * Resolve + cache a token by contract address. Returns the RankedCoin
 * (also upserted into `coins`), or null when nothing resolves.
 */
export async function resolveAndCacheToken(
  address: string
): Promise<RankedCoin | null> {
  const resolved = await resolveToken(address);
  if (!resolved) return null;

  const supabase = getSupabase();
  const norm = normalizeAddress(resolved.address);
  const id = `dex-${resolved.chain}-${norm}`;
  const short = (norm.startsWith("0x") ? norm.slice(2) : norm)
    .slice(0, 8)
    .toLowerCase();
  const slug = sanitizeSlugPart(`${resolved.symbol}-${short}`) || `token-${short}`;
  const supply = resolved.price > 0 ? resolved.marketCap / resolved.price : null;
  const color = colorForSymbol(resolved.symbol);

  const coin: RankedCoin = {
    id,
    slug,
    symbol: resolved.symbol.slice(0, 16),
    name: resolved.name.slice(0, 64),
    price: resolved.price,
    marketCap: resolved.marketCap,
    circulatingSupply: supply,
    athPrice: null, // DEX aggregators don't expose ATH → ATH toggle hides
    color,
    logo: null,
    source: "dexscreener",
    coingeckoId: null,
    chain: resolved.chain,
    rank: 0,
  };

  // Without Supabase we can't persist, but the client can still flip using
  // the returned object (compare falls back to it).
  if (!supabase) return coin;

  try {
    // Reuse an already self-hosted logo; only download on first sight.
    const existing = await supabase
      .from("coins")
      .select("logo")
      .eq("id", id)
      .maybeSingle();
    const logo =
      (existing.data?.logo as string | undefined) ??
      (await selfHostLogo(supabase, id, resolved.imageUrl));

    const rankRes = await supabase
      .from("coins")
      .select("id", { count: "exact", head: true })
      .gt("market_cap", resolved.marketCap);
    const rank = (rankRes.count ?? 0) + 1;

    await supabase.from("coins").upsert(
      {
        id,
        slug,
        symbol: coin.symbol,
        name: coin.name,
        rank,
        price: coin.price,
        market_cap: coin.marketCap,
        circulating_supply: supply,
        ath_price: null,
        color,
        logo,
        source: "dexscreener",
        coingecko_id: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    return { ...coin, logo: logo ?? null, rank };
  } catch {
    return coin; // resolution worked; persistence didn't — still usable
  }
}
