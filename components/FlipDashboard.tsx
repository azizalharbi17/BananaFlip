"use client";

import { useEffect, useRef, useState } from "react";
import CoinCard from "./CoinCard";
import HotFlips, { type HotRow } from "./HotFlips";
import Verdict from "./Verdict";
import { pairSlug } from "@/lib/pairs";
import type { CompareResult, RankedCoin } from "@/lib/types";

interface FlipDashboardProps {
  /** Top coins — picker default list and distance-bar scale. */
  coins: RankedCoin[];
  initialChallenger: RankedCoin;
  initialTarget: RankedCoin;
  hotRows: HotRow[];
  /** Hot-flips header hint; defaults to the reference's "tap a row…". */
  hotCaption?: string;
}

const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The comparison machine: challenger/target cards, the FLIP button with
 * the rotateX swap from the reference, the verdict panel and the hot-flips
 * table. Keeps the address bar pointing at the shareable /a-flip-b URL.
 */
export default function FlipDashboard({
  coins,
  initialChallenger,
  initialTarget,
  hotRows,
  hotCaption,
}: FlipDashboardProps) {
  const [pair, setPair] = useState(() => ({
    a: initialChallenger,
    b: initialTarget,
  }));
  // Incremented whenever the verdict price should animate (render(true)).
  const [pulse, setPulse] = useState(0);
  const fwrapRef = useRef<HTMLDivElement>(null);
  const flipping = useRef(false);

  const selectCoin = (side: "A" | "B") => (coin: RankedCoin) => {
    setPair((p) => (side === "A" ? { ...p, a: coin } : { ...p, b: coin }));
    setPulse((n) => n + 1);
  };

  const loadPair = (a: RankedCoin, b: RankedCoin) => {
    setPair({ a, b });
    setPulse((n) => n + 1);
    window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
  };

  /**
   * The flip, ported from the reference: rotate the whole row edge-on
   * (.18s ease-in), swap the coins while invisible, snap to the opposite
   * edge, rotate back (.18s ease-out), then count the verdict up.
   */
  const doFlip = () => {
    if (flipping.current) return;
    const swap = () => setPair((p) => ({ a: p.b, b: p.a }));
    const el = fwrapRef.current;
    if (!el || reducedMotion()) {
      swap();
      setPulse((n) => n + 1);
      return;
    }
    flipping.current = true;
    let swapped = false;
    // Only the wrapper's own transform counts — transitionend bubbles up
    // from the FLIP button's hover/active transitions inside the row.
    const isOwn = (ev: TransitionEvent) =>
      ev.target === el && ev.propertyName === "transform";
    const cleanup = () => {
      window.clearTimeout(watchdog);
      el.removeEventListener("transitionend", onEnd);
      el.removeEventListener("transitionend", onBackEnd);
      el.style.transition = ""; // hand control back to the stylesheet
      el.style.transform = "";
      flipping.current = false;
    };
    const onEnd = (ev: TransitionEvent) => {
      if (!isOwn(ev)) return;
      el.removeEventListener("transitionend", onEnd);
      swapped = true;
      swap();
      el.style.transition = "none";
      el.style.transform = "rotateX(-90deg)";
      void el.offsetHeight;
      el.style.transition = "transform .18s ease-out";
      el.style.transform = "rotateX(0deg)";
      el.addEventListener("transitionend", onBackEnd);
      window.setTimeout(() => setPulse((n) => n + 1), 40);
    };
    const onBackEnd = (ev: TransitionEvent) => {
      if (!isOwn(ev)) return;
      cleanup();
    };
    // Never let a lost transitionend wedge the machine.
    const watchdog = window.setTimeout(() => {
      if (!swapped) {
        swap();
        setPulse((n) => n + 1);
      }
      cleanup();
    }, 1000);
    el.addEventListener("transitionend", onEnd);
    el.style.transform = "rotateX(90deg)";
  };

  // Keep the URL shareable: /<challenger>-flip-<target> after any change.
  const urlSynced = useRef(false);
  useEffect(() => {
    if (!urlSynced.current) {
      urlSynced.current = true; // initial URL comes from the server route
      return;
    }
    if (pair.a.slug === pair.b.slug) return;
    const slug = pairSlug({ challengerSlug: pair.a.slug, targetSlug: pair.b.slug });
    window.history.replaceState(null, "", `/${slug}`);
    document.title = `Can ${pair.a.symbol} flip ${pair.b.symbol}? — BananaFlip`;
  }, [pair.a.slug, pair.b.slug, pair.a.symbol, pair.b.symbol]);

  // Refresh both sides from the internal compare API on pair change, so a
  // long-lived tab picks up new prices as the cron updates them.
  useEffect(() => {
    if (pair.a.slug === pair.b.slug) return;
    const ctrl = new AbortController();
    fetch(`/api/compare?challenger=${pair.a.slug}&target=${pair.b.slug}`, {
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: CompareResult | null) => {
        if (!data) return;
        setPair((prev) => {
          if (prev.a.slug !== data.challenger.slug || prev.b.slug !== data.target.slug) {
            return prev; // stale response — the pair moved on
          }
          // Adopt the server objects unconditionally: ISR-cached page props
          // can lag the API by a data generation (prices, ATH fields).
          return { a: data.challenger, b: data.target };
        });
      })
      .catch(() => {
        /* offline or aborted — keep the data we have */
      });
    return () => ctrl.abort();
  }, [pair.a.slug, pair.b.slug]);

  return (
    <>
      <div className="machine" id="machine">
        <div className="fwrap" ref={fwrapRef}>
          <CoinCard
            roleLabel="Coin A"
            side="A"
            coin={pair.a}
            coins={coins}
            onSelect={selectCoin("A")}
          />
          <div className="seam">
            <button
              className="flip-btn"
              type="button"
              aria-label="Flip the two coins"
              onClick={doFlip}
            >
              <span>
                <span className="arrows">⇄</span>FLIP
              </span>
            </button>
          </div>
          <CoinCard
            roleLabel="Coin B"
            side="B"
            coin={pair.b}
            coins={coins}
            onSelect={selectCoin("B")}
          />
        </div>
      </div>

      <Verdict a={pair.a} b={pair.b} coins={coins} pulse={pulse} />

      <HotFlips rows={hotRows} caption={hotCaption} onLoadPair={loadPair} />
    </>
  );
}
