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

/* Thresholds fitted against the real top-ranked logos (measured in the
   browser): keep BTC/DOGE/SOL/PEPE/BNB bare while USDT/TRX/ADA/LTC/XRP/ETH
   get the disc. */
const MIN_CONTRAST = 3; // WCAG ratio vs the panel below this → disc
const FULL_BLEED_COVERAGE = 0.95; // tile-filling marks (squares)…
const FULL_BLEED_CONTRAST = 3.4; // …need a bit more contrast (PEPE: 3.75)
const SATURATED_CHROMA = 97; // flat saturated colors (max−min channel)…
const SATURATED_CONTRAST = 7; // …read darker than their ratio (USDT: 6.5)

function srgbToLinear(channel: number): number {
  const v = channel / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** Panel surface the logos sit on (~#14100a). */
const PANEL_LUMINANCE = relativeLuminance(20, 16, 10);

/**
 * WCAG contrast of the logo's average opaque color against the panel.
 * Too little contrast, a full-bleed dark tile, or a flat mid-dark
 * saturated color (multi-hue gradients like SOL average toward gray and
 * are exempt) → render on the light disc.
 */
function logoNeedsLightDisc(img: HTMLImageElement): boolean {
  const S = 32;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(img, 0, 0, S, S);
  const data = ctx.getImageData(0, 0, S, S).data;
  let visible = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < ALPHA_CUTOFF) continue;
    visible += 1;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  if (visible === 0) return true;
  r /= visible;
  g /= visible;
  b /= visible;

  const lum = relativeLuminance(r, g, b);
  const contrast =
    (Math.max(lum, PANEL_LUMINANCE) + 0.05) / (Math.min(lum, PANEL_LUMINANCE) + 0.05);
  const coverage = visible / (S * S);
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);

  if (contrast < MIN_CONTRAST) return true;
  if (coverage >= FULL_BLEED_COVERAGE && contrast < FULL_BLEED_CONTRAST) return true;
  if (chroma >= SATURATED_CHROMA && contrast < SATURATED_CONTRAST) return true;
  return false;
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
  // Prefer a stored logo URL — same-origin paths ("/logos/…", self-hosted
  // pinned coins) or an external https CDN — otherwise derive it from the
  // coinpaprika id convention via our proxy; otherwise the monogram.
  const storedLogo = coin.logo ?? null;
  const externalLogo = storedLogo?.startsWith("https://") ? storedLogo : null;
  const sameOriginLogo = storedLogo?.startsWith("/") ? storedLogo : null;
  // The coinpaprika id→CDN convention only applies to binance-source coins;
  // coingecko/dexscreener coins carry an explicit logo (or none → monogram),
  // so they never do a doomed coinpaprika lookup.
  const paprikaLogo =
    (!coin.source || coin.source === "binance") && coin.id.includes("-")
      ? `/api/logo/${coin.id}`
      : null;
  const logoSrc = sameOriginLogo ?? externalLogo ?? paprikaLogo;
  // 0 = first try, 1 = cache-busted retry, ≥2 = give up → monogram. A
  // transient load error must not stick the fallback (it used to: after a
  // flip the errored state survived until a full page reload).
  const [attempt, setAttempt] = useState(0);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const imgRef = useRef<HTMLImageElement>(null);

  // New src (coin changed under this position, e.g. the FLIP swap) —
  // fresh chances even if the previous logo errored.
  useEffect(() => setAttempt(0), [logoSrc]);

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
  }, [coin.id, attempt]);

  if (logoSrc && attempt <= 1) {
    const onLight = needsLightDisc.get(coin.id) === true;
    const src =
      attempt === 0
        ? logoSrc
        : `${logoSrc}${logoSrc.includes("?") ? "&" : "?"}retry=1`;
    return (
      // Tiny favicons with a JS error fallback — next/image's optimizer
      // adds nothing here. Keyed by coin id so a flip REMOUNTS the img
      // instead of mutating src/crossOrigin on a live node — mobile
      // Safari serves a CORS-mode mismatch from cache as a hard error,
      // which is how ANSEM's logo used to die after a flip.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={coin.id}
        ref={imgRef}
        className={`disc${onLight ? " on-light" : ""}`}
        src={src}
        // Only external CDN logos need CORS mode (for the canvas check);
        // same-origin images are canvas-clean by definition.
        crossOrigin={externalLogo ? "anonymous" : undefined}
        alt=""
        width={42}
        height={42}
        loading="lazy"
        onLoad={(e) => evaluate(e.currentTarget)}
        onError={() => setAttempt((a) => a + 1)}
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
