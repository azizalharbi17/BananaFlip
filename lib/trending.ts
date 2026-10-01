/* Trending-token discovery for the Hot Flips cron.

   Source: GeckoTerminal's trending-pools feeds — ranked by real on-chain
   activity (volume, trades), not paid promotion. They are reduced here to
   one candidate per token carrying its strongest trending pool's
   liquidity and 24h volume, then filtered (liquidity / volume floors,
   stables and wrapped natives, coins already in the curated list).
   Price / market cap / logo are NOT resolved here: the cron hands every
   survivor to the existing DexScreener resolver (lib/token-resolve.ts),
   so a trending token is indistinguishable from a manually pasted one.

   API contract (public v2, no key), verified against the maintained
   clients of the live API (geckoterminal-api on pypi, gecko-terminal-cli
   and @exortek/geckoterminal-api on npm) and the published reference:

     GET /networks/trending_pools?include=base_token,network&page=1&duration=24h
     GET /networks/{network}/trending_pools?include=base_token&page=1&duration=24h
       duration ∈ 5m | 1h | 6h | 24h (default 24h)
       include  ∈ base_token, quote_token, dex (+ network, cross-network feed)
       ~30 requests / minute on the public tier

     data[]: { id: "<network>_<pool>", type: "pool",
               attributes: { address, name, base_token_price_usd, fdv_usd,
                             market_cap_usd, reserve_in_usd,
                             volume_usd: { h24, … }, transactions,
                             pool_created_at },
               relationships: { base_token: { data: { id: "<network>_<token>" } },
                                network:    { data: { id: "<network>" } } } }
     included[]: { id: "<network>_<token>", type: "token",
                   attributes: { address, name, symbol, image_url,
                                 coingecko_coin_id } }

   Numbers arrive as strings; market_cap_usd / fdv_usd / image_url can be
   null. Everything below treats a missing field as "unknown" rather than
   throwing — a shape drift degrades to fewer candidates, never a crash
   (and the cron keeps the last known set when nothing survives). */

import { isContractAddress } from "./dexscreener";

export type TrendingDuration = "5m" | "1h" | "6h" | "24h";

export interface TrendingConfig {
  /** GeckoTerminal network ids to scan with their per-network feeds. */
  networks: string[];
  /** Trending window GeckoTerminal ranks by. */
  duration: TrendingDuration;
  /** Floors a token's strongest trending pool must clear (USD). */
  minLiquidityUsd: number;
  minVolumeUsd: number;
  /** Size of the trending set (= Hot Flips rows). */
  limit: number;
  /** Sanity ceiling: anything bigger is a major that slipped the dedupe. */
  maxMarketCapUsd: number;
  /** Parallel resolutions. Each one uploads a logo to Supabase Storage,
   *  which uses the project's Postgres pool — 8 tripped "too many
   *  connections" on the logo backfill, so this is capped at 3. */
  concurrency: number;
}

export const DEFAULT_TRENDING_CONFIG: TrendingConfig = {
  networks: ["solana", "base", "eth", "bsc"],
  duration: "24h",
  minLiquidityUsd: 100_000,
  minVolumeUsd: 100_000,
  limit: 15,
  maxMarketCapUsd: 20_000_000_000,
  concurrency: 3,
};

const DURATIONS: readonly TrendingDuration[] = ["5m", "1h", "6h", "24h"];
const MAX_CONCURRENCY = 3;

function envNumber(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** TrendingConfig from the environment — every knob optional, clamped. */
export function trendingConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): TrendingConfig {
  const d = DEFAULT_TRENDING_CONFIG;
  const networks = (env.TRENDING_NETWORKS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const duration = env.TRENDING_DURATION as TrendingDuration | undefined;
  return {
    networks: networks.length ? networks : d.networks,
    duration: duration && DURATIONS.includes(duration) ? duration : d.duration,
    minLiquidityUsd: envNumber(env.TRENDING_MIN_LIQUIDITY_USD, d.minLiquidityUsd, 0, 1e12),
    minVolumeUsd: envNumber(env.TRENDING_MIN_VOLUME_USD, d.minVolumeUsd, 0, 1e12),
    limit: Math.round(envNumber(env.TRENDING_LIMIT, d.limit, 1, 30)),
    maxMarketCapUsd: envNumber(env.TRENDING_MAX_MCAP_USD, d.maxMarketCapUsd, 1e6, 1e15),
    concurrency: Math.round(
      envNumber(env.TRENDING_CONCURRENCY, d.concurrency, 1, MAX_CONCURRENCY)
    ),
  };
}

/** GeckoTerminal network id → DexScreener chainId (what the resolver
 *  reports as `chain`; must match or it's a different token). */
const CHAIN_BY_NETWORK: Record<string, string> = {
  eth: "ethereum",
  solana: "solana",
  base: "base",
  bsc: "bsc",
  arbitrum: "arbitrum",
  polygon_pos: "polygon",
  avax: "avalanche",
  optimism: "optimism",
  ton: "ton",
  sui: "sui",
  tron: "tron",
};

export function chainForNetwork(network: string): string {
  return CHAIN_BY_NETWORK[network] ?? network;
}

export interface TrendingCandidate {
  /** GeckoTerminal network id. */
  network: string;
  /** DexScreener chain id. */
  chain: string;
  address: string;
  /** From the feed's included token; empty when the feed omitted it (the
   *  resolver supplies the real one). */
  symbol: string;
  name: string;
  imageUrl: string | null;
  /** Strongest trending pool's figures (max across the token's pools). */
  liquidityUsd: number;
  volume24hUsd: number;
  /** GeckoTerminal's own cap (market_cap_usd, else fdv_usd) — informational;
   *  the stored cap comes from the resolver. */
  marketCapUsd: number | null;
  /** 1 = top of the merged ranking; lower is "more trending". */
  position: number;
  /** Feeds it appeared in and where, e.g. "all#3", "solana#1". */
  feeds: string[];
}

/* ---------- feed parsing ---------- */

interface GtPool {
  id?: string;
  attributes?: {
    address?: string;
    name?: string;
    base_token_price_usd?: string | null;
    fdv_usd?: string | null;
    market_cap_usd?: string | null;
    reserve_in_usd?: string | null;
    volume_usd?: Record<string, string | null>;
    pool_created_at?: string | null;
  };
  relationships?: {
    base_token?: { data?: { id?: string; type?: string } };
    network?: { data?: { id?: string; type?: string } };
  };
}

interface GtToken {
  id?: string;
  type?: string;
  attributes?: {
    address?: string;
    name?: string;
    symbol?: string;
    image_url?: string | null;
    coingecko_coin_id?: string | null;
  };
}

interface GtResponse {
  data?: GtPool[];
  included?: GtToken[];
}

interface FeedEntry {
  network: string;
  address: string;
  symbol: string;
  name: string;
  imageUrl: string | null;
  liquidityUsd: number;
  volume24hUsd: number;
  marketCapUsd: number | null;
  feed: string;
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** "<network>_<address>" → [network, address]. Network ids can contain
 *  underscores (polygon_pos), so match the known network first. */
function splitTokenId(
  id: string,
  known: string | null,
  configured: string[]
): [string, string] | null {
  if (known && id.startsWith(`${known}_`)) return [known, id.slice(known.length + 1)];
  for (const n of [...configured, ...Object.keys(CHAIN_BY_NETWORK)]) {
    if (id.startsWith(`${n}_`)) return [n, id.slice(n.length + 1)];
  }
  const sep = id.indexOf("_");
  return sep > 0 ? [id.slice(0, sep), id.slice(sep + 1)] : null;
}

/** One feed → ordered token entries (one per pool; merged later). */
export function entriesFromFeed(
  body: GtResponse,
  feed: string,
  network: string | null,
  configuredNetworks: string[]
): FeedEntry[] {
  const tokens = new Map<string, NonNullable<GtToken["attributes"]>>();
  for (const inc of body.included ?? []) {
    if (inc?.type === "token" && inc.id) tokens.set(inc.id, inc.attributes ?? {});
  }
  const out: FeedEntry[] = [];
  (body.data ?? []).forEach((pool) => {
    const tokenId = pool?.relationships?.base_token?.data?.id;
    if (!tokenId) return;
    const poolNetwork = pool.relationships?.network?.data?.id ?? null;
    const split = splitTokenId(tokenId, network ?? poolNetwork, configuredNetworks);
    if (!split) return;
    const [net, address] = split;
    if (network && net !== network) return; // per-network feed: trust the request
    const t = tokens.get(tokenId);
    const a = pool.attributes ?? {};
    const image = t?.image_url;
    out.push({
      network: net,
      address: (t?.address ?? address).trim(),
      symbol: (t?.symbol ?? "").trim(),
      name: (t?.name ?? "").trim(),
      imageUrl: typeof image === "string" && image.startsWith("http") ? image : null,
      liquidityUsd: toNumber(a.reserve_in_usd) ?? 0,
      volume24hUsd: toNumber(a.volume_usd?.h24) ?? 0,
      marketCapUsd: toNumber(a.market_cap_usd) ?? toNumber(a.fdv_usd),
      feed,
    });
  });
  return out;
}

/* ---------- fetching ---------- */

const FEED_TIMEOUT_MS = 10_000;
/** Pause between feed calls — well under the public ceiling, and polite. */
const FEED_GAP_MS = 300;

function baseUrl(): string {
  return (
    process.env.GECKOTERMINAL_API_BASE ?? "https://api.geckoterminal.com/api/v2"
  ).replace(/\/+$/, "");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchFeed(
  path: string,
  params: Record<string, string>
): Promise<GtResponse> {
  const url = new URL(`${baseUrl()}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    cache: "no-store",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${path} responded ${res.status}`);
  const body = (await res.json()) as GtResponse;
  if (!body || typeof body !== "object" || !Array.isArray(body.data)) {
    throw new Error(`${path} returned an unexpected payload`);
  }
  return body;
}

function normalizeAddress(address: string): string {
  return /^0x[a-fA-F0-9]{40}$/.test(address) ? address.toLowerCase() : address;
}

/** Stable key for "the same token": chain + (case-folded for EVM) address. */
export function candidateKey(c: { chain: string; address: string }): string {
  return `${c.chain}:${normalizeAddress(c.address)}`;
}

/**
 * Pull the cross-network feed plus one feed per configured network and
 * merge them into a single ranking: the cross-network order first (it is
 * GeckoTerminal's global view), then the per-network feeds interleaved
 * round-robin so one chain can't crowd out the rest. A token's first
 * sighting fixes its position; its figures take the max over its pools.
 *
 * Throws only when EVERY feed failed (network down, 429 storm) — the
 * cron then keeps the last set. Returns [] when the feeds answered but
 * had nothing, which the cron treats the same way.
 */
export async function fetchTrendingCandidates(
  config: TrendingConfig
): Promise<TrendingCandidate[]> {
  const feeds: { name: string; path: string; include: string; network: string | null }[] = [
    { name: "all", path: "/networks/trending_pools", include: "base_token,network", network: null },
    ...config.networks.map((n) => ({
      name: n,
      path: `/networks/${encodeURIComponent(n)}/trending_pools`,
      include: "base_token",
      network: n,
    })),
  ];

  const perFeed: FeedEntry[][] = [];
  const errors: string[] = [];
  for (let i = 0; i < feeds.length; i++) {
    const f = feeds[i];
    if (i > 0) await sleep(FEED_GAP_MS);
    try {
      const body = await fetchFeed(f.path, {
        include: f.include,
        page: "1",
        duration: config.duration,
      });
      perFeed.push(entriesFromFeed(body, f.name, f.network, config.networks));
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
      perFeed.push([]);
    }
  }
  if (errors.length === feeds.length) {
    throw new Error(`every trending feed failed: ${errors.join("; ")}`);
  }

  const ordered: FeedEntry[] = [...perFeed[0]];
  const perNetwork = perFeed.slice(1);
  const longest = Math.max(0, ...perNetwork.map((r) => r.length));
  for (let i = 0; i < longest; i++) {
    for (const r of perNetwork) if (r[i]) ordered.push(r[i]);
  }

  const byKey = new Map<string, TrendingCandidate>();
  ordered.forEach((e, i) => {
    const chain = chainForNetwork(e.network);
    const key = candidateKey({ chain, address: e.address });
    const feedTag = `${e.feed}#${i + 1}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, {
        network: e.network,
        chain,
        address: e.address,
        symbol: e.symbol,
        name: e.name,
        imageUrl: e.imageUrl,
        liquidityUsd: e.liquidityUsd,
        volume24hUsd: e.volume24hUsd,
        marketCapUsd: e.marketCapUsd,
        position: byKey.size + 1,
        feeds: [feedTag],
      });
      return;
    }
    prev.liquidityUsd = Math.max(prev.liquidityUsd, e.liquidityUsd);
    prev.volume24hUsd = Math.max(prev.volume24hUsd, e.volume24hUsd);
    prev.marketCapUsd = prev.marketCapUsd ?? e.marketCapUsd;
    prev.imageUrl = prev.imageUrl ?? e.imageUrl;
    prev.symbol = prev.symbol || e.symbol;
    prev.name = prev.name || e.name;
    prev.feeds.push(feedTag);
  });
  return [...byKey.values()];
}

/* ---------- quality filters ---------- */

/** Stablecoins, wrapped natives and liquid-staking tokens that show up
 *  as pool base tokens — never "trending", never Hot Flips material. */
const QUOTE_LIKE = new Set([
  "USDC", "USDT", "USDE", "SUSDE", "USD1", "USDS", "USDG", "DAI", "FDUSD",
  "PYUSD", "TUSD", "BUSD", "USDBC", "USDC.E", "USDT.E", "EURC", "GHO",
  "FRAX", "LUSD", "CRVUSD", "USR", "USDH",
  "WETH", "ETH", "WBTC", "BTC", "CBBTC", "TBTC", "WSOL", "SOL", "WBNB",
  "BNB", "WMATIC", "WPOL", "WAVAX", "WTRX", "WTON", "TON",
  "STETH", "WSTETH", "WEETH", "RETH", "CBETH", "EZETH", "RSETH", "JITOSOL",
  "MSOL", "BSOL", "JUPSOL", "BNSOL",
]);

export function isQuoteLikeSymbol(symbol: string): boolean {
  return QUOTE_LIKE.has(symbol.trim().toUpperCase());
}

export type DropReason =
  | "bad-address"
  | "quote-like"
  | "established"
  | "low-liquidity"
  | "low-volume"
  | "too-big";

export interface FilterOptions {
  config: TrendingConfig;
  /** Upper-cased symbols of the curated list — BTC/ETH/PEPE are never
   *  "trending", they're already in the picker. */
  establishedSymbols: Set<string>;
}

/** Why a candidate must not go to Hot Flips, or null when it may. Symbol
 *  checks are skipped when the feed gave no symbol — the cron repeats
 *  them on the resolver's symbol. */
export function dropReason(
  c: TrendingCandidate,
  { config, establishedSymbols }: FilterOptions
): DropReason | null {
  if (!isContractAddress(c.address)) return "bad-address";
  const sym = c.symbol.toUpperCase();
  if (sym && isQuoteLikeSymbol(sym)) return "quote-like";
  if (sym && establishedSymbols.has(sym)) return "established";
  if (c.liquidityUsd < config.minLiquidityUsd) return "low-liquidity";
  if (c.volume24hUsd < config.minVolumeUsd) return "low-volume";
  if (c.marketCapUsd !== null && c.marketCapUsd > config.maxMarketCapUsd) return "too-big";
  return null;
}

export function filterCandidates(
  candidates: TrendingCandidate[],
  options: FilterOptions
): { kept: TrendingCandidate[]; dropped: Partial<Record<DropReason, number>> } {
  const kept: TrendingCandidate[] = [];
  const dropped: Partial<Record<DropReason, number>> = {};
  for (const c of candidates) {
    const reason = dropReason(c, options);
    if (reason) dropped[reason] = (dropped[reason] ?? 0) + 1;
    else kept.push(c);
  }
  return { kept, dropped };
}
