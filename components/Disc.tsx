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
  // Prefer a stored logo URL (e.g. CoinGecko-sourced coins like $ANSEM);
  // otherwise derive it from the coinpaprika id convention via our proxy;
  // otherwise fall back to the colored monogram.
  const externalLogo =
    coin.logo && coin.logo.startsWith("https://") ? coin.logo : null;
  const logoSrc =
    externalLogo ?? (coin.id.includes("-") ? `/api/logo/${coin.id}` : null);
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

  if (logoSrc && !failed) {
    const onLight = needsLightDisc.get(coin.id) === true;
    return (
      // Tiny favicons with a JS error fallback — next/image's optimizer
      // adds nothing here.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={imgRef}
        className={`disc${onLight ? " on-light" : ""}`}
        src={logoSrc}
        // External CDN logos load in CORS mode (CoinGecko sends ACAO:*) so
        // the canvas legibility check stays untainted; the same-origin
        // proxy needs no crossOrigin.
        crossOrigin={externalLogo ? "anonymous" : undefined}
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
