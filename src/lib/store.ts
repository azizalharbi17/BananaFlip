import type { Coin } from "./types";
import { getProvider } from "./provider";

/**
 * In-memory cached coin table.
 *
 * Every API route and server component reads from here — never from a
 * third-party API. The cache hydrates from the active CoinProvider and is
 * considered fresh for TTL_MS; `refreshStore()` can also be forced by the
 * cron route once a live provider is wired in.
 */
const TTL_MS = 5 * 60 * 1000;

interface StoreState {
  coins: Coin[];
  byId: Map<string, Coin>;
  fetchedAt: Date;
  loadedAt: number;
}

let state: StoreState | null = null;
let inflight: Promise<StoreState> | null = null;

async function load(): Promise<StoreState> {
  const { coins, fetchedAt } = await getProvider().fetchCoins();
  return {
    coins,
    byId: new Map(coins.map((c) => [c.id, c])),
    fetchedAt,
    loadedAt: Date.now(),
  };
}

async function ensureFresh(): Promise<StoreState> {
  if (state && Date.now() - state.loadedAt < TTL_MS) return state;
  if (!inflight) {
    inflight = load().finally(() => {
      inflight = null;
    });
  }
  state = await inflight;
  return state;
}

/** Force a refresh from the provider (used by the cron route). */
export async function refreshStore(): Promise<{ count: number; fetchedAt: Date }> {
  state = await load();
  return { count: state.coins.length, fetchedAt: state.fetchedAt };
}

export async function getCoins(): Promise<Coin[]> {
  return (await ensureFresh()).coins;
}

export async function getCoin(id: string): Promise<Coin | undefined> {
  return (await ensureFresh()).byId.get(id.trim().toLowerCase());
}

export async function getDataTimestamp(): Promise<Date> {
  return (await ensureFresh()).fetchedAt;
}

/**
 * Rank-aware fuzzy search across symbol, name and id.
 * An empty query returns the top coins (used to pre-fill the dropdown).
 */
export async function searchCoins(query: string, limit = 8): Promise<Coin[]> {
  const { coins } = await ensureFresh();
  const q = query.trim().toLowerCase();
  if (!q) return coins.slice(0, limit);

  const scored: { coin: Coin; score: number }[] = [];
  for (const coin of coins) {
    const symbol = coin.symbol.toLowerCase();
    const name = coin.name.toLowerCase();
    let score = -1;
    if (symbol === q || name === q || coin.id === q) score = 100;
    else if (symbol.startsWith(q)) score = 80;
    else if (name.startsWith(q)) score = 70;
    else if (name.split(/\s+/).some((w) => w.startsWith(q))) score = 60;
    else if (symbol.includes(q)) score = 40;
    else if (name.includes(q) || coin.id.includes(q)) score = 30;
    if (score >= 0) {
      // Small boost for bigger coins so "b" ranks BTC above BONK.
      scored.push({ coin, score: score - coin.rank * 0.05 });
    }
  }
  scored.sort((x, y) => y.score - x.score);
  return scored.slice(0, limit).map((s) => s.coin);
}
