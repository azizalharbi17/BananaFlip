import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteContent from "@/components/SiteContent";
import { getCoinById, getRankedCoins } from "@/lib/coins";
import { compareCoins } from "@/lib/compare";
import { fmtBig, fmtPrice, fmtX } from "@/lib/format";
import { HOT_PAIRS, pairSlug, parsePairSlug } from "@/lib/pairs";
import type { RankedCoin } from "@/lib/types";

/**
 * Shareable comparison pages: /pepe-flip-doge. The hot pairs and every
 * ordered pair of the top 8 coins are built at compile time; any other
 * valid pair is generated on first request and cached (dynamicParams).
 */
export async function generateStaticParams() {
  const ranked = await getRankedCoins();
  const top = ranked.slice(0, 8);
  const slugs = new Set(HOT_PAIRS.map(pairSlug));
  for (const a of top) {
    for (const b of top) {
      if (a.id !== b.id) {
        slugs.add(pairSlug({ challengerId: a.id, targetId: b.id }));
      }
    }
  }
  return [...slugs].map((pair) => ({ pair }));
}

async function resolvePair(
  slug: string
): Promise<{ a: RankedCoin; b: RankedCoin } | null> {
  const ids = parsePairSlug(slug);
  if (!ids) return null;
  const [a, b] = await Promise.all([
    getCoinById(ids.challengerId),
    getCoinById(ids.targetId),
  ]);
  return a && b ? { a, b } : null;
}

interface PairPageProps {
  params: { pair: string };
}

export async function generateMetadata({ params }: PairPageProps): Promise<Metadata> {
  const resolved = await resolvePair(params.pair);
  if (!resolved) return { title: "Flip not found" };

  const { a, b } = resolved;
  const r = compareCoins(a, b);
  const title = `Can ${a.symbol} flip ${b.symbol}?`;
  const description = r.alreadyFlipped
    ? `${a.name} has already flipped ${b.name} — its market cap is ${fmtX(
        1 / r.multiplier
      )} the size. At ${b.symbol}'s market cap, ${a.symbol} would be ${fmtPrice(
        r.impliedPrice
      )}. Demo data.`
    : `${a.name} at ${b.name}'s market cap would be ${fmtPrice(
        r.impliedPrice
      )} per ${a.symbol} — a ${fmtX(r.multiplier)} from today, ${fmtBig(
        r.capGap
      )} of market cap away. Run the flip math. Demo data.`;
  const canonical = `/${pairSlug({ challengerId: a.id, targetId: b.id })}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${title} — BananaFlip`,
      description,
      url: canonical,
    },
    twitter: {
      card: "summary",
      title: `${title} — BananaFlip`,
      description,
    },
  };
}

export default async function PairPage({ params }: PairPageProps) {
  const resolved = await resolvePair(params.pair);
  if (!resolved) notFound();

  const coins = await getRankedCoins();
  return (
    <SiteContent coins={coins} challengerId={resolved.a.id} targetId={resolved.b.id} />
  );
}
