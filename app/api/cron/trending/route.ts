import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { resolveAndCacheTokenDetailed, type ResolvedCoin } from "@/lib/token-resolve";
import {
  candidateKey,
  filterCandidates,
  fetchTrendingCandidates,
  isQuoteLikeSymbol,
  trendingConfigFromEnv,
  type TrendingCandidate,
  type TrendingConfig,
} from "@/lib/trending";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Stop starting new resolutions past this, leaving room for the writes. */
const TIME_BUDGET_MS = 45_000;
/** Main-list window whose symbols count as "established" for the dedupe. */
const ESTABLISHED_RANK_CEILING = 500;
/** Resolve at most this many candidates per run (bounds API calls). */
const RESOLVE_MULTIPLIER = 2;

type Supabase = NonNullable<ReturnType<typeof getSupabase>>;

/**
 * GET/POST /api/cron/trending — refresh the auto-discovered trending set
 * behind "Hot Flips". Scheduled by Vercel Cron (vercel.json, every 2h);
 * Vercel sends `Authorization: Bearer $CRON_SECRET` itself, so the route
 * is never publicly triggerable.
 *
 *   GeckoTerminal trending pools (volume/activity) ─▶ quality filters
 *     ─▶ the existing DexScreener resolver (price, cap, self-hosted logo)
 *     ─▶ coins rows (source='dexscreener') flagged is_trending + rank.
 *
 * Every successful run REPLACES the set (stale flags cleared; rows stay).
 * Any upstream failure or an empty / fully-filtered result leaves the
 * previous set untouched — Hot Flips never blanks out.
 */
async function run(request: Request): Promise<NextResponse> {
  const t0 = Date.now();

  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" },
      { status: 500 }
    );
  }

  const config = trendingConfigFromEnv();

  // 1. Discover. A dead feed keeps the last known set.
  let candidates: TrendingCandidate[];
  try {
    candidates = await fetchTrendingCandidates(config);
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        kept: true,
        error: `GeckoTerminal: ${e instanceof Error ? e.message : String(e)}`,
        ms: Date.now() - t0,
      },
      { status: 502 }
    );
  }
  if (candidates.length === 0) {
    return NextResponse.json({
      ok: true,
      kept: true,
      reason: "trending feeds returned no pools",
      ms: Date.now() - t0,
    });
  }

  // 2. Filter: liquidity / volume floors, stables & wrapped natives, and
  //    anything already in the curated list (BTC/ETH are never "trending").
  let established: Set<string>;
  try {
    established = await loadEstablishedSymbols(supabase);
  } catch (e) {
    return NextResponse.json(
      { ok: false, kept: true, error: `Failed to read coins: ${errorMessage(e)}` },
      { status: 502 }
    );
  }
  const { kept, dropped } = filterCandidates(candidates, {
    config,
    establishedSymbols: established,
  });
  const queue = kept.slice(0, config.limit * RESOLVE_MULTIPLIER);

  // 3. Resolve through the shared DexScreener path, a few at a time.
  const { resolved, skipped } = await resolveQueue(queue, config, established, t0);
  const trending = queue
    .filter((c) => resolved.has(candidateKey(c)))
    .slice(0, config.limit)
    .map((c) => ({ candidate: c, ...resolved.get(candidateKey(c))! }));

  if (trending.length === 0) {
    return NextResponse.json({
      ok: true,
      kept: true,
      reason: "no candidate resolved cleanly",
      discovered: candidates.length,
      candidates: kept.length,
      dropped,
      skipped,
      ms: Date.now() - t0,
    });
  }

  // 4. Replace the set: flag the new rows, then clear whatever was
  //    trending before and isn't now. Rows are never deleted.
  const now = new Date().toISOString();
  const { data: before, error: readError } = await supabase
    .from("coins")
    .select("id")
    .eq("is_trending", true);
  if (readError) {
    return NextResponse.json(
      {
        ok: false,
        kept: true,
        error: `Failed to read the current trending set: ${readError.message} (has supabase/migrations/0006_coin_trending.sql been applied?)`,
      },
      { status: 502 }
    );
  }

  const rows = trending.map(({ coin }, i) => ({
    id: coin.id,
    slug: coin.slug,
    symbol: coin.symbol,
    name: coin.name,
    rank: coin.rank,
    price: coin.price,
    market_cap: coin.marketCap,
    circulating_supply: coin.circulatingSupply ?? null,
    ath_price: null,
    color: coin.color,
    logo: coin.logo,
    source: "dexscreener",
    coingecko_id: null,
    is_trending: true,
    trending_rank: i + 1,
    trending_at: now,
    updated_at: now,
  }));
  const { error: upsertError } = await supabase
    .from("coins")
    .upsert(rows, { onConflict: "id" });
  if (upsertError) {
    return NextResponse.json(
      { ok: false, kept: true, error: `Failed to flag the trending set: ${upsertError.message}` },
      { status: 502 }
    );
  }

  const newIds = new Set(rows.map((r) => r.id));
  const stale = ((before ?? []) as { id: string }[])
    .map((r) => r.id)
    .filter((id) => !newIds.has(id));
  if (stale.length > 0) {
    const { error: clearError } = await supabase
      .from("coins")
      .update({ is_trending: false, trending_rank: null })
      .in("id", stale);
    if (clearError) {
      revalidateTag("coins");
      return NextResponse.json(
        {
          ok: false,
          kept: false,
          error: `New set written but ${stale.length} stale flag(s) not cleared: ${clearError.message}`,
        },
        { status: 502 }
      );
    }
  }

  revalidateTag("coins"); // Hot Flips picks the new set up immediately

  return NextResponse.json({
    ok: true,
    replaced: true,
    count: trending.length,
    cleared: stale.length,
    trending: trending.map(({ coin, resolved: r, candidate }, i) => ({
      rank: i + 1,
      id: coin.id,
      slug: coin.slug,
      symbol: coin.symbol,
      name: coin.name,
      chain: coin.chain,
      price: coin.price,
      marketCap: coin.marketCap,
      logo: coin.logo,
      liquidityUsd: r.liquidityUsd ?? candidate.liquidityUsd,
      volume24hUsd: r.volume24hUsd ?? candidate.volume24hUsd,
      feeds: candidate.feeds,
    })),
    discovered: candidates.length,
    candidates: kept.length,
    dropped,
    skipped,
    config: {
      networks: config.networks,
      duration: config.duration,
      minLiquidityUsd: config.minLiquidityUsd,
      minVolumeUsd: config.minVolumeUsd,
      limit: config.limit,
    },
    ms: Date.now() - t0,
  });
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Upper-cased symbols of the curated list — coinpaprika coins within
 *  the main window plus every pinned CoinGecko coin — the dedupe set. */
async function loadEstablishedSymbols(supabase: Supabase): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("coins")
    .select("symbol")
    .in("source", ["binance", "coingecko"])
    .or(`rank.lte.${ESTABLISHED_RANK_CEILING},source.eq.coingecko`)
    .limit(ESTABLISHED_RANK_CEILING + 50);
  if (error) throw new Error(error.message);
  return new Set(
    ((data ?? []) as { symbol: string }[]).map((r) => String(r.symbol).toUpperCase())
  );
}

type SkipReason =
  | "unresolved"
  | "resolve-error"
  | "chain-mismatch"
  | "no-price-or-cap"
  | "no-logo"
  | "too-big"
  | "quote-like"
  | "established"
  | "low-liquidity"
  | "low-volume";

/** Post-resolution gate on the resolver's own numbers: Hot Flips only
 *  gets tokens with a price, a cap, a self-hosted logo, enough liquidity
 *  and volume, and that aren't a major wearing a trending pool. */
function skipReason(
  r: ResolvedCoin,
  config: TrendingConfig,
  established: Set<string>
): SkipReason | null {
  const { coin, resolved } = r;
  if (!(coin.price > 0) || !(coin.marketCap > 0)) return "no-price-or-cap";
  if (!coin.logo) return "no-logo";
  if (coin.marketCap > config.maxMarketCapUsd) return "too-big";
  const sym = coin.symbol.toUpperCase();
  if (isQuoteLikeSymbol(sym)) return "quote-like";
  if (established.has(sym)) return "established";
  if (resolved.liquidityUsd !== null && resolved.liquidityUsd < config.minLiquidityUsd) {
    return "low-liquidity";
  }
  if (resolved.volume24hUsd !== null && resolved.volume24hUsd < config.minVolumeUsd) {
    return "low-volume";
  }
  return null;
}

/**
 * Resolve candidates in ranking order with a small worker pool. Stops
 * once `limit` tokens passed (later candidates rank lower anyway) or the
 * time budget is spent. Returns the passes keyed by candidate.
 */
async function resolveQueue(
  queue: TrendingCandidate[],
  config: TrendingConfig,
  established: Set<string>,
  t0: number
): Promise<{
  resolved: Map<string, ResolvedCoin>;
  skipped: Partial<Record<SkipReason, number>>;
}> {
  const resolved = new Map<string, ResolvedCoin>();
  const skipped: Partial<Record<SkipReason, number>> = {};
  const skip = (reason: SkipReason) => {
    skipped[reason] = (skipped[reason] ?? 0) + 1;
  };
  let next = 0;

  const worker = async () => {
    while (next < queue.length) {
      if (resolved.size >= config.limit) return;
      if (Date.now() - t0 > TIME_BUDGET_MS) return;
      const c = queue[next++];
      try {
        const r = await resolveAndCacheTokenDetailed(c.address, {
          imageUrlFallback: c.imageUrl,
          expectedChain: c.chain,
        });
        if (!r) {
          skip("unresolved");
          continue;
        }
        const reason = skipReason(r, config, established);
        if (reason) skip(reason);
        else resolved.set(candidateKey(c), r);
      } catch {
        skip("resolve-error");
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(config.concurrency, queue.length) }, worker)
  );
  return { resolved, skipped };
}

export { run as GET, run as POST };
