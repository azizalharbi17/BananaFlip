import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteContent from "@/components/SiteContent";
import { getCoinBySlug, getRankedCoins } from "@/lib/coins";
import { compareCoins } from "@/lib/compare";
import { fmtBig, fmtPrice, fmtX } from "@/lib/format";
import { HOT_PAIRS, pairSlug, parsePairSlug } from "@/lib/pairs";
import type { RankedCoin } from "@/lib/types";

/** Re-render with fresh prices as the cron updates them. */
export const revalidate = 60;

/**
 * Shareable comparison pages: /pepe-flip-doge. Only the hot pairs and the
 * top-10 permutations are built at compile time — with ~2000 live coins,
 * everything else renders on first request and is cached (dynamicParams).
 */
export async function generateStaticParams() {
  const coins = await getRankedCoins();
  const top = coins.slice(0, 10);
  const slugs = new Set(HOT_PAIRS.map(pairSlug));
  for (const a of top) {
    for (const b of top) {
      if (a.slug !== b.slug) {
        slugs.add(pairSlug({ challengerSlug: a.slug, targetSlug: b.slug }));
      }
    }
  }
  return [...slugs].map((pair) => ({ pair }));
}

async function resolvePair(
  slug: string
): Promise<{ a: RankedCoin; b: RankedCoin } | null> {
  const parsed = parsePairSlug(slug);
  if (!parsed) return null;
  const [a, b] = await Promise.all([
    getCoinBySlug(parsed.challengerSlug),
    getCoinBySlug(parsed.targetSlug),
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
      )}.`
    : `${a.name} at ${b.name}'s market cap would be ${fmtPrice(
        r.impliedPrice
      )} per ${a.symbol} — a ${fmtX(r.multiplier)} from today, ${fmtBig(
        r.capGap
      )} of market cap away. Run the flip math.`;
  const canonical = `/${pairSlug({ challengerSlug: a.slug, targetSlug: b.slug })}`;

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

  return <SiteContent challenger={resolved.a} target={resolved.b} />;
}
