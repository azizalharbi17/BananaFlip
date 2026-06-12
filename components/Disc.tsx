"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { discTextColor } from "@/lib/format";
import type { Coin } from "@/lib/types";

/**
 * Light-disc verdicts cached per coin id for the whole session — each
 * logo is analyzed once, so re-renders never flicker or recompute.
 */
const needsLightDisc = new Map<string, boolean>();

const ALPHA_CUTOFF = 16; // ignore near-transparent pixels
const DARK_LUMINANCE = 0.3; // below this average, the mark needs the disc
const MIN_COVERAGE = 0.05; // an almost-empty mark reads as dark too

/** Average luminance + alpha coverage of the rendered logo. */
function logoNeedsLightDisc(img: HTMLImageElement): boolean {
  const S = 24;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(img, 0, 0, S, S);
  const data = ctx.getImageData(0, 0, S, S).data;
  let lumSum = 0;
  let visible = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < ALPHA_CUTOFF) continue;
    visible += 1;
    lumSum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
  }
  if (visible === 0) return true;
  return lumSum / visible < DARK_LUMINANCE || visible / (S * S) < MIN_COVERAGE;
}

/**
 * Coin badge: the coinpaprika logo (served via our same-origin proxy)
 * when one can exist, otherwise the two-letter colored monogram from the
 * reference design. After the logo loads, its pixels decide whether it
 * sits bare or on a warm off-white disc so dark marks (XRP, ETH) stay
 * legible on the dark panels. Demo-seed ids (no "-") aren't coinpaprika
 * ids, so demo mode goes straight to the monogram; live logos that fail
 * to load fall back to it too. Sizes come from context selectors in
 * globals.css (.menu .disc, .pair .disc), exactly like the reference.
 */
export default function Disc({ coin }: { coin: Coin }) {
  const hasLogo = coin.id.includes("-");
  const [failed, setFailed] = useState(false);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const imgRef = useRef<HTMLImageElement>(null);

  // A new coin gets a fresh chance even if the previous logo 404'd.
  useEffect(() => setFailed(false), [coin.id]);

  const evaluate = (img: HTMLImageElement) => {
    if (needsLightDisc.has(coin.id)) return;
    try {
      needsLightDisc.set(coin.id, logoNeedsLightDisc(img));
    } catch {
      needsLightDisc.set(coin.id, false); // unreadable canvas — stay bare
    }
    rerender();
  };

  // SSR'd images can finish loading before hydration, skipping onLoad.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) evaluate(img);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coin.id, failed]);

  if (hasLogo && !failed) {
    const onLight = needsLightDisc.get(coin.id) === true;
    return (
      // Tiny same-origin favicons with a JS error fallback — next/image's
      // optimizer adds nothing here.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={imgRef}
        className={`disc${onLight ? " on-light" : ""}`}
        src={`/api/logo/${coin.id}`}
        alt=""
        width={42}
        height={42}
        loading="lazy"
        onLoad={(e) => evaluate(e.currentTarget)}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className="disc"
      style={{ background: coin.color, color: discTextColor(coin.color) }}
    >
      {coin.symbol.slice(0, 2)}
    </span>
  );
}
