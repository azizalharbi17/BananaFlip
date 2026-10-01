import { colorForSymbol } from "./colors";
import { resolveToken, type ResolvedToken } from "./dexscreener";
import { sanitizeSlugPart } from "./slugs";
import { getSupabase } from "./supabase";
import type { RankedCoin } from "./types";

/* Resolve a contract address into a full coin: live values from
   DexScreener, a self-hosted logo, and a row in the coins table so
   compare / pair pages / repeat loads all work. Used by the picker
   (/api/resolve) and by the trending cron — one path, one kind of row. */

const BUCKET = "token-logos";
const MAX_LOGO_BYTES = 3_000_000;
/** Storage uploads go through the project's Postgres pool and can refuse
 *  transiently ("too many connections") — retry with backoff like the
 *  logo backfill does, instead of shipping a monogram. */
const UPLOAD_ATTEMPTS = 3;
const UPLOAD_BACKOFF_MS = 1_500;

export interface ResolveOptions {
  /** Logo to self-host when the resolver's own source has none (e.g. the
   *  trending feed's image_url). */
  imageUrlFallback?: string | null;
  /** Reject a resolution on another chain: the same EVM address can be a
   *  different token elsewhere, and the trending feed knows its chain. */
  expectedChain?: string | null;
}

export interface ResolvedCoin {
  /** The coin as served to the client (and upserted into `coins`). */
  coin: RankedCoin;
  /** The raw resolver result, with the liquidity / volume signals. */
  resolved: ResolvedToken;
}

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
    for (let attempt = 1; attempt <= UPLOAD_ATTEMPTS; attempt++) {
      const up = await supabase.storage
        .from(BUCKET)
        .upload(id, bytes, { contentType, upsert: true });
      if (!up.error) return `/api/token-logo/${encodeURIComponent(id)}`;
      if (attempt < UPLOAD_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, UPLOAD_BACKOFF_MS * attempt));
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve + cache a token by contract address, returning both the coin
 * (also upserted into `coins`) and the raw resolver result. Null when
 * nothing resolves or the chain isn't the expected one.
 */
export async function resolveAndCacheTokenDetailed(
  address: string,
  options: ResolveOptions = {}
): Promise<ResolvedCoin | null> {
  const resolved = await resolveToken(address);
  if (!resolved) return null;
  if (options.expectedChain && resolved.chain !== options.expectedChain) return null;

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
  if (!supabase) return { coin, resolved };

  try {
    // Reuse an already self-hosted logo; only download on first sight.
    const existing = await supabase
      .from("coins")
      .select("logo")
      .eq("id", id)
      .maybeSingle();
    const logo =
      (existing.data?.logo as string | undefined) ??
      (await selfHostLogo(
        supabase,
        id,
        resolved.imageUrl ?? options.imageUrlFallback ?? null
      ));

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
    return { coin: { ...coin, logo: logo ?? null, rank }, resolved };
  } catch {
    return { coin, resolved }; // resolution worked; persistence didn't — still usable
  }
}

/**
 * Resolve + cache a token by contract address. Returns the RankedCoin
 * (also upserted into `coins`), or null when nothing resolves.
 */
export async function resolveAndCacheToken(
  address: string,
  options: ResolveOptions = {}
): Promise<RankedCoin | null> {
  return (await resolveAndCacheTokenDetailed(address, options))?.coin ?? null;
}
