"use client";

import { useEffect, useRef, useState } from "react";
import type { Coin, CompareResult } from "@/lib/types";
import { compareCoins } from "@/lib/compare";
import { TokenSearch } from "./token-search";
import { FlipResult } from "./flip-result";

const PARTICLES = 9;

function FlipSwapButton({
  onFlip,
  spin,
  burst,
  disabled,
}: {
  onFlip: () => void;
  spin: number;
  burst: number;
  disabled: boolean;
}) {
  return (
    <div className="relative">
      {burst > 0 &&
        Array.from({ length: PARTICLES }).map((_, i) => (
          <span
            key={`${burst}-${i}`}
            aria-hidden="true"
            className="peel-particle text-lg"
            style={{ "--spin": `${(360 / PARTICLES) * i + 12}deg` } as React.CSSProperties}
          >
            🍌
          </span>
        ))}
      <button
        type="button"
        onClick={onFlip}
        disabled={disabled}
        aria-label="Flip the two coins"
        title="Flip!"
        className="group relative z-10 grid h-16 w-16 place-items-center rounded-full border-2 border-ink bg-banana-400 shadow-hard transition-[transform,box-shadow,background-color] duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] hover:bg-banana-300 active:shadow-none disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-hard"
        style={{ transform: `rotate(${spin}deg)` }}
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
          <path
            d="M7 4 L7 17 M7 17 L3.5 13.5 M7 17 L10.5 13.5"
            stroke="#231A0E"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M17 20 L17 7 M17 7 L13.5 10.5 M17 7 L20.5 10.5"
            stroke="#231A0E"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

/**
 * The core widget: two coin slots, one very satisfying flip button.
 *
 * Results are computed optimistically on the client with the same pure
 * `compareCoins` used on the server, then confirmed against /api/compare
 * (the canonical cached table).
 */
export function FlipComparator({
  initialA = null,
  initialB = null,
  initialResult = null,
}: {
  initialA?: Coin | null;
  initialB?: Coin | null;
  initialResult?: CompareResult | null;
}) {
  const [a, setA] = useState<Coin | null>(initialA);
  const [b, setB] = useState<Coin | null>(initialB);
  const [result, setResult] = useState<CompareResult | null>(initialResult);
  const [error, setError] = useState<string | null>(null);
  const [spin, setSpin] = useState(0);
  const [burst, setBurst] = useState(0);
  const [flipKey, setFlipKey] = useState(0);
  const hidePermalink = useRef(initialResult !== null);

  useEffect(() => {
    if (!a || !b) {
      setResult(null);
      setError(null);
      return;
    }
    // Instant optimistic math…
    setResult(compareCoins(a, b));
    setError(null);

    // …confirmed by the canonical API.
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `/api/compare?a=${encodeURIComponent(a.id)}&b=${encodeURIComponent(b.id)}`,
          { signal: controller.signal },
        );
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Something slipped. Try again.");
          return;
        }
        setResult(data);
      } catch {
        /* aborted or offline — optimistic result stands */
      }
    })();
    return () => controller.abort();
  }, [a, b]);

  const flip = () => {
    setA(b);
    setB(a);
    setSpin((s) => s + 180);
    setBurst((n) => n + 1);
    setFlipKey((k) => k + 1);
    hidePermalink.current = false;
  };

  return (
    <div className="space-y-5">
      <div className="grid items-center gap-3 md:grid-cols-[1fr_auto_1fr] md:gap-4">
        <div
          key={`a-${flipKey}`}
          className={flipKey > 0 ? "animate-card-flip" : undefined}
          style={{ transformOrigin: "center bottom" }}
        >
          <TokenSearch
            label="The challenger 🥊"
            selected={a}
            onSelect={(coin) => {
              setA(coin);
              hidePermalink.current = false;
            }}
            excludeId={b?.id}
            placeholder="Who's flipping? Try PEPE…"
          />
        </div>

        <div className="flex justify-center md:pt-5">
          <FlipSwapButton onFlip={flip} spin={spin} burst={burst} disabled={!a && !b} />
        </div>

        <div
          key={`b-${flipKey}`}
          className={flipKey > 0 ? "animate-card-flip" : undefined}
          style={{ transformOrigin: "center bottom" }}
        >
          <TokenSearch
            label="The top banana 👑"
            selected={b}
            onSelect={(coin) => {
              setB(coin);
              hidePermalink.current = false;
            }}
            excludeId={a?.id}
            placeholder="…flipping whom? Try DOGE"
          />
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border-2 border-bruise-500 bg-bruise-500/10 px-4 py-3 text-sm font-bold text-bruise-600"
        >
          {error}
        </div>
      )}

      {result && !error ? (
        <div key={result.slug} className="animate-pop-in">
          <FlipResult data={result} hidePermalink={hidePermalink.current} />
        </div>
      ) : (
        !error && (
          <div className="rounded-blob border-2 border-dashed border-ink/30 bg-paper/60 px-6 py-10 text-center">
            <p className="font-display text-lg font-bold text-ink-soft">
              {!a && !b
                ? "Pick two coins to run the flippening math."
                : "One more coin and we'll do the math."}
            </p>
            <p className="mt-1.5 font-mono text-xs text-ink-faint">
              priceA × (mcapB ÷ mcapA) = the dream, quantified
            </p>
          </div>
        )
      )}
    </div>
  );
}
