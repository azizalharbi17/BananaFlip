import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCoin, getCoins } from "@/lib/store";
import { compareCoins } from "@/lib/compare";
import { pairToSlug, parseSlug } from "@/lib/slug";
import { TRENDING_PAIRS } from "@/lib/trending";
import { formatCompactUsd, formatMultiplier, formatUsd } from "@/lib/format";
import { FlipComparator } from "@/components/flip-comparator";
import { CoinLogo } from "@/components/coin-logo";

export const revalidate = 300;
export const dynamicParams = true;

/** Pre-render the curated pairs (both directions) at build time. */
export async function generateStaticParams() {
  return TRENDING_PAIRS.flatMap(([a, b]) => [
    { slug: pairToSlug(a, b) },
    { slug: pairToSlug(b, a) },
  ]);
}

async function getFlip(slug: string) {
  const pair = parseSlug(slug);
  if (!pair || pair.aId === pair.bId) return null;
  const [a, b] = await Promise.all([getCoin(pair.aId), getCoin(pair.bId)]);
  if (!a || !b) return null;
  return compareCoins(a, b);
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const flip = await getFlip(params.slug);
  if (!flip) return { title: "Flip not found" };
  const { a, b, multiplier, hypotheticalPrice } = flip;

  const title = `Can ${a.symbol} flip ${b.symbol}? (${formatMultiplier(multiplier)})`;
  const description = `If ${a.name} had ${b.name}'s market cap, 1 ${a.symbol} would be worth ${formatUsd(
    hypotheticalPrice,
  )} — ${formatMultiplier(multiplier)} today's price. Run the flippening math on BananaFlip.`;

  return {
    title,
    description,
    alternates: { canonical: `/${flip.slug}` },
    openGraph: { title, description, url: `/${flip.slug}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

async function RelatedFlips({ aId, bId }: { aId: string; bId: string }) {
  const coins = await getCoins();
  const seen = new Set([pairToSlug(aId, bId)]);
  const related: { slug: string; label: string }[] = [];

  for (const target of coins.slice(0, 12)) {
    for (const sourceId of [aId, bId]) {
      if (target.id === sourceId || target.id === aId || target.id === bId) continue;
      const source = coins.find((c) => c.id === sourceId);
      if (!source) continue;
      const slug = pairToSlug(sourceId, target.id);
      if (seen.has(slug)) continue;
      seen.add(slug);
      related.push({ slug, label: `${source.symbol} → ${target.symbol}` });
    }
    if (related.length >= 8) break;
  }

  return (
    <nav aria-label="Related flips" className="flex flex-wrap gap-2.5">
      {related.slice(0, 8).map((r) => (
        <Link
          key={r.slug}
          href={`/${r.slug}`}
          className="sticker bg-paper text-xs transition-[transform,box-shadow] hover:-translate-y-0.5 hover:bg-banana-200 hover:shadow-hard"
        >
          {r.label}
        </Link>
      ))}
    </nav>
  );
}

export default async function FlipPage({ params }: { params: { slug: string } }) {
  const flip = await getFlip(params.slug);
  if (!flip) notFound();

  const { a, b, multiplier, hypotheticalPrice, alreadyFlipped } = flip;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="mx-auto max-w-3xl text-center">
        <div className="flex items-center justify-center gap-1">
          <CoinLogo coin={a} size="xl" className="rotate-[-6deg] ring-2 ring-ink" />
          <span className="z-10 -mx-3 mt-8 inline-block rounded-full border-2 border-ink bg-banana-400 px-2.5 py-1 font-display text-sm font-extrabold shadow-hard-sm">
            VS
          </span>
          <CoinLogo coin={b} size="xl" className="rotate-[6deg] ring-2 ring-ink" />
        </div>
        <h1 className="mt-5 font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          Can {a.name} flip {b.name}?
        </h1>
        {/* server-rendered verdict paragraph — the SEO meat */}
        <p className="mx-auto mt-4 max-w-2xl text-balance text-ink-soft">
          {a.name} ({a.symbol}) trades at {formatUsd(a.price)} with a market cap of{" "}
          {formatCompactUsd(a.market_cap)} (#{a.rank}). {b.name} ({b.symbol}) holds{" "}
          {formatCompactUsd(b.market_cap)} (#{b.rank}).{" "}
          {alreadyFlipped ? (
            <>
              <strong className="text-ink">{a.symbol} has already flipped {b.symbol}</strong> — at{" "}
              {b.symbol}&apos;s cap, 1 {a.symbol} would slip to{" "}
              <strong className="text-ink">{formatUsd(hypotheticalPrice)}</strong>.
            </>
          ) : (
            <>
              To flip it, {a.symbol} must grow{" "}
              <strong className="text-ink">{formatMultiplier(multiplier)}</strong>, putting its
              price at <strong className="text-ink">{formatUsd(hypotheticalPrice)}</strong>.
            </>
          )}
        </p>
      </header>

      <div className="card mt-10 p-5 sm:p-8">
        <FlipComparator initialA={a} initialB={b} initialResult={flip} />
      </div>

      <section className="mt-12">
        <h2 className="font-display text-xl font-extrabold">Keep flipping</h2>
        <div className="mt-4">
          <RelatedFlips aId={a.id} bId={b.id} />
        </div>
      </section>
    </div>
  );
}
