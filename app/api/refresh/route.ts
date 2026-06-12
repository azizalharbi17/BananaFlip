import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { colorForCoin } from "@/lib/colors";
import { assignSlug } from "@/lib/slugs";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TICKERS_URL = "https://api.coinpaprika.com/v1/tickers";
const MAX_RANK = 2000;
const UPSERT_CHUNK = 500;
const DB_PAGE = 1000;

interface PaprikaTicker {
  id: string;
  name: string;
  symbol: string;
  rank: number;
  circulating_supply?: number;
  quotes?: { USD?: { price?: number; market_cap?: number; ath_price?: number } };
}

/**
 * POST/GET /api/refresh — pull live tickers from coinpaprika into the
 * Supabase `coins` table. Secured with `Authorization: Bearer CRON_SECRET`;
 * called every 10 minutes by .github/workflows/refresh.yml.
 */
async function refresh(request: Request): Promise<NextResponse> {
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

  const res = await fetch(TICKERS_URL, {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: `coinpaprika responded ${res.status}` },
      { status: 502 }
    );
  }
  const tickers = (await res.json()) as PaprikaTicker[];
  if (!Array.isArray(tickers)) {
    return NextResponse.json(
      { error: "Unexpected coinpaprika payload" },
      { status: 502 }
    );
  }

  const eligible = tickers.filter((t) => {
    const cap = t.quotes?.USD?.market_cap ?? 0;
    return t.rank >= 1 && t.rank <= MAX_RANK && cap > 0 && t.id && t.symbol && t.name;
  });
  const skipped = tickers.length - eligible.length;

  // Slugs are assigned once and never change: load what's already taken.
  const slugById = new Map<string, string>();
  const taken = new Set<string>();
  for (let from = 0; ; from += DB_PAGE) {
    const { data, error } = await supabase
      .from("coins")
      .select("id,slug")
      .order("id", { ascending: true })
      .range(from, from + DB_PAGE - 1);
    if (error) {
      return NextResponse.json(
        { error: `Failed to read existing slugs: ${error.message}` },
        { status: 502 }
      );
    }
    for (const row of data as { id: string; slug: string }[]) {
      slugById.set(row.id, row.slug);
      taken.add(row.slug);
    }
    if (!data || data.length < DB_PAGE) break;
  }

  // Best rank first, so on first sight the lowest-rank coin in a symbol
  // collision claims the clean slug.
  eligible.sort((a, b) => a.rank - b.rank);

  const now = new Date().toISOString();
  const rows = eligible.map((t) => {
    let slug = slugById.get(t.id);
    if (!slug) {
      slug = assignSlug(t, taken);
      taken.add(slug);
    }
    const price = t.quotes!.USD!.price ?? 0;
    const marketCap = t.quotes!.USD!.market_cap!;
    // coinpaprika often sends circulating_supply: null; market_cap/price
    // IS the circulating supply by definition, so derive it then.
    const circulating =
      t.circulating_supply ?? (price > 0 ? marketCap / price : null);
    return {
      id: t.id,
      slug,
      symbol: t.symbol,
      name: t.name,
      rank: t.rank,
      price,
      market_cap: marketCap,
      circulating_supply: circulating,
      ath_price: t.quotes!.USD!.ath_price ?? null,
      color: colorForCoin(slug, t.symbol),
      updated_at: now,
    };
  });

  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK);
    const { error } = await supabase.from("coins").upsert(chunk, { onConflict: "id" });
    if (error) {
      return NextResponse.json(
        { error: `Upsert failed at chunk ${i / UPSERT_CHUNK}: ${error.message}` },
        { status: 502 }
      );
    }
  }

  revalidateTag("coins"); // serve fresh numbers immediately

  return NextResponse.json({ updated: rows.length, skipped, ms: Date.now() - t0 });
}

export { refresh as GET, refresh as POST };
