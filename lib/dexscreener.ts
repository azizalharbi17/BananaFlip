/* Live token resolution for the long tail — any on-chain token by
   contract address, across chains, with no API key. DexScreener is the
   workhorse (address-only, all chains); GeckoTerminal is a best-effort
   fallback when DexScreener has nothing. */

export interface ResolvedToken {
  /** The queried contract address (as given). */
  address: string;
  /** DexScreener/GeckoTerminal chain id: solana, ethereum, base, bsc… */
  chain: string;
  symbol: string;
  name: string;
  price: number;
  /** DexScreener marketCap, falling back to FDV — the number people see
   *  there (same full-supply rule as pump.fun coins). */
  marketCap: number;
  /** Logo the source itself displays, or null. */
  imageUrl: string | null;
  /** Top pair's liquidity and 24h volume (USD) — quality signals for the
   *  trending cron; null when the source doesn't report them. */
  liquidityUsd: number | null;
  volume24hUsd: number | null;
}

/* API hosts, overridable for local testing against a stub (production
   always talks to the public APIs). */
const DEX_API = "https://api.dexscreener.com";
const GT_API = "https://api.geckoterminal.com/api/v2";
const dexBase = () => (process.env.DEXSCREENER_API_BASE ?? DEX_API).replace(/\/+$/, "");
const gtBase = () => (process.env.GECKOTERMINAL_API_BASE ?? GT_API).replace(/\/+$/, "");

const EVM_RE = /^0x[a-fA-F0-9]{40}$/;
const SOLANA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** True when a query is a pasteable contract address (EVM or Solana). */
export function isContractAddress(q: string): boolean {
  const s = q.trim();
  return EVM_RE.test(s) || SOLANA_RE.test(s);
}

interface DexPair {
  chainId?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  marketCap?: number;
  fdv?: number;
  info?: { imageUrl?: string };
}

async function fromDexScreener(address: string): Promise<ResolvedToken | null> {
  const res = await fetch(
    `${dexBase()}/latest/dex/tokens/${encodeURIComponent(address)}`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  const body = (await res.json()) as { pairs?: DexPair[] };
  const key = address.toLowerCase();
  // Only pairs where OUR token is the base — otherwise a stablecoin quote
  // pair would hand back the stablecoin's name and price.
  const own = (body.pairs ?? []).filter(
    (p) => (p.baseToken?.address ?? "").toLowerCase() === key
  );
  if (own.length === 0) return null;
  own.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));

  const top = own[0];
  const price = Number(top.priceUsd);
  const marketCap = top.marketCap ?? top.fdv ?? 0;
  if (!(price > 0) || !(marketCap > 0)) return null;

  // Prefer the top pair's image; if absent, take the first pair that has one.
  const imageUrl =
    top.info?.imageUrl ?? own.find((p) => p.info?.imageUrl)?.info?.imageUrl ?? null;

  return {
    address,
    chain: top.chainId ?? "unknown",
    symbol: (top.baseToken?.symbol ?? "").trim() || "TOKEN",
    name: (top.baseToken?.name ?? "").trim() || top.baseToken?.symbol || "Token",
    price,
    marketCap,
    imageUrl,
    liquidityUsd: typeof top.liquidity?.usd === "number" ? top.liquidity.usd : null,
    volume24hUsd: typeof top.volume?.h24 === "number" ? top.volume.h24 : null,
  };
}

/** GeckoTerminal token endpoint needs a network; DexScreener being empty
 *  means we don't know it, so guess by address shape (Solana) or try the
 *  major EVM networks. Only reached when DexScreener has nothing. */
async function fromGeckoTerminal(address: string): Promise<ResolvedToken | null> {
  const networks = SOLANA_RE.test(address)
    ? ["solana"]
    : ["eth", "base", "bsc", "arbitrum", "polygon_pos", "avax"];
  for (const net of networks) {
    try {
      const res = await fetch(
        `${gtBase()}/networks/${net}/tokens/${encodeURIComponent(address)}`,
        { cache: "no-store", headers: { accept: "application/json" } }
      );
      if (!res.ok) continue;
      const a = ((await res.json()) as { data?: { attributes?: Record<string, unknown> } })
        ?.data?.attributes;
      if (!a) continue;
      const price = Number(a.price_usd);
      const marketCap = Number(a.market_cap_usd ?? a.fdv_usd);
      if (!(price > 0) || !(marketCap > 0)) continue;
      return {
        address,
        chain: net === "eth" ? "ethereum" : net,
        symbol: String(a.symbol ?? "TOKEN"),
        name: String(a.name ?? a.symbol ?? "Token"),
        price,
        marketCap,
        imageUrl: typeof a.image_url === "string" && a.image_url.startsWith("http")
          ? (a.image_url as string)
          : null,
        liquidityUsd: Number(a.total_reserve_in_usd) > 0 ? Number(a.total_reserve_in_usd) : null,
        volume24hUsd:
          Number((a.volume_usd as { h24?: unknown } | undefined)?.h24) > 0
            ? Number((a.volume_usd as { h24?: unknown }).h24)
            : null,
      };
    } catch {
      /* try the next network */
    }
  }
  return null;
}

/** Resolve a contract address to a token, or null if nothing is found. */
export async function resolveToken(address: string): Promise<ResolvedToken | null> {
  if (!isContractAddress(address)) return null;
  try {
    const dex = await fromDexScreener(address);
    if (dex) return dex;
  } catch {
    /* fall through to GeckoTerminal */
  }
  return fromGeckoTerminal(address);
}
