"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CompareResult } from "@/lib/types";
import {
  formatCompactUsd,
  formatMultiplier,
  formatPct,
  formatUsd,
} from "@/lib/format";
import { CountUp } from "./count-up";
import { GapVisual } from "./gap-visual";
import { CoinLogo } from "./coin-logo";

function ShareRow({ slug, hidePermalink }: { slug: string; hidePermalink?: boolean }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${slug}`);
      setCopied(true);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button type="button" onClick={copy} className="btn-banana px-4 py-2.5 text-sm">
        {copied ? "Copied! 🍌" : "Copy share link"}
      </button>
      {!hidePermalink && (
        <Link href={`/${slug}`} className="btn-ghost px-4 py-2.5 text-sm">
          Open flip page →
        </Link>
      )}
      <code className="hidden rounded-lg bg-ink/5 px-2.5 py-1.5 font-mono text-xs text-ink-soft sm:block">
        /{slug}
      </code>
    </div>
  );
}

/**
 * The verdict card. Client component for the count-up roll, but it
 * server-renders with final values so flip pages ship real numbers in HTML.
 */
export function FlipResult({
  data,
  hidePermalink = false,
}: {
  data: CompareResult;
  hidePermalink?: boolean;
}) {
  const { a, b, multiplier, hypotheticalPrice, alreadyFlipped } = data;
  const pctChange = (multiplier - 1) * 100;

  return (
    <div className="card overflow-hidden">
      {/* verdict header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink bg-banana-100 px-5 py-4 sm:px-7">
        <p className="flex items-center gap-2 font-display text-sm font-bold text-ink-soft sm:text-base">
          <CoinLogo coin={a} size="sm" />
          If <span className="text-ink">{a.symbol}</span> had{" "}
          <span className="text-ink">{b.symbol}</span>&apos;s market cap
          <CoinLogo coin={b} size="sm" />
        </p>
        <span
          className={`sticker rotate-2 ${
            alreadyFlipped ? "bg-bruise-500 text-cream" : "bg-leaf-500 text-cream"
          }`}
        >
          {alreadyFlipped ? `${formatPct(pctChange)} 📉` : `${formatMultiplier(multiplier)} 🚀`}
        </span>
      </div>

      <div className="space-y-6 px-5 py-6 sm:px-7">
        {/* the number */}
        <div>
          <p className="stat-label">1 {a.symbol} would be worth</p>
          <p className="mt-1 font-display text-5xl font-extrabold leading-none tracking-tight sm:text-6xl">
            <CountUp value={hypotheticalPrice} format={formatUsd} />
          </p>
          <p className="mt-2.5 text-sm text-ink-soft">
            {alreadyFlipped ? (
              <>
                {a.symbol} already flipped {b.symbol}. Shrinking to {b.symbol}&apos;s cap would
                drag it <strong className="text-bruise-600">{formatPct(pctChange, false)}</strong>{" "}
                from {formatUsd(a.price)}.
              </>
            ) : (
              <>
                That&apos;s{" "}
                <strong className="text-leaf-600">{formatMultiplier(multiplier)}</strong> today&apos;s
                price of {formatUsd(a.price)} — a {formatPct(pctChange)} move.
              </>
            )}
          </p>
        </div>

        <GapVisual a={a} b={b} multiplier={multiplier} />

        {/* the receipts */}
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: `${a.symbol} price`, value: formatUsd(a.price) },
            { label: `${a.symbol} cap · #${a.rank}`, value: formatCompactUsd(a.market_cap) },
            { label: `${b.symbol} price`, value: formatUsd(b.price) },
            { label: `${b.symbol} cap · #${b.rank}`, value: formatCompactUsd(b.market_cap) },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border-2 border-ink/10 bg-cream px-3 py-2.5">
              <dt className="stat-label text-[0.62rem]">{stat.label}</dt>
              <dd className="mt-0.5 font-mono text-sm font-semibold tabular">{stat.value}</dd>
            </div>
          ))}
        </dl>

        <ShareRow slug={data.slug} hidePermalink={hidePermalink} />
      </div>
    </div>
  );
}
