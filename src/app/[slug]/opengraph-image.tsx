import { ImageResponse } from "next/og";
import { getCoin } from "@/lib/store";
import { parseSlug } from "@/lib/slug";
import { compareCoins } from "@/lib/compare";
import { formatMultiplier, formatUsd } from "@/lib/format";

export const runtime = "nodejs";
export const alt = "BananaFlip market cap comparison";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ink = "#231A0E";
const banana = "#FFD23F";
const cream = "#FBF4E2";

function Disc({ color, symbol }: { color: string; symbol: string }) {
  return (
    <div
      style={{
        width: 120,
        height: 120,
        borderRadius: 999,
        background: color,
        border: `5px solid ${ink}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontSize: symbol.length > 3 ? 30 : 40,
        fontWeight: 700,
      }}
    >
      {symbol}
    </div>
  );
}

export default async function OgImage({ params }: { params: { slug: string } }) {
  const pair = parseSlug(params.slug);
  const [a, b] = pair
    ? await Promise.all([getCoin(pair.aId), getCoin(pair.bId)])
    : [undefined, undefined];

  if (!a || !b) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: cream,
            color: ink,
            fontSize: 80,
            fontWeight: 700,
          }}
        >
          🍌 BananaFlip
        </div>
      ),
      size,
    );
  }

  const flip = compareCoins(a, b);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: cream,
          color: ink,
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 36, fontWeight: 700 }}>
          <span style={{ fontSize: 44 }}>🍌</span> BananaFlip
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 56 }}>
          <Disc color={a.color} symbol={a.symbol} />
          <div
            style={{
              display: "flex",
              background: banana,
              border: `5px solid ${ink}`,
              borderRadius: 24,
              padding: "10px 24px",
              fontSize: 40,
              fontWeight: 700,
              transform: "rotate(-3deg)",
            }}
          >
            VS
          </div>
          <Disc color={b.color} symbol={b.symbol} />
        </div>

        <div style={{ display: "flex", fontSize: 76, fontWeight: 800, marginTop: 48, letterSpacing: -2 }}>
          Can {a.symbol} flip {b.symbol}?
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 28, fontSize: 38 }}>
          <span
            style={{
              display: "flex",
              background: flip.alreadyFlipped ? "#2E9E44" : banana,
              color: flip.alreadyFlipped ? cream : ink,
              border: `5px solid ${ink}`,
              borderRadius: 20,
              padding: "8px 22px",
              fontWeight: 800,
            }}
          >
            {flip.alreadyFlipped ? "ALREADY FLIPPED" : `${formatMultiplier(flip.multiplier)} TO GO`}
          </span>
          <span style={{ display: "flex" }}>
            1 {a.symbol} → {formatUsd(flip.hypotheticalPrice)}
          </span>
        </div>
      </div>
    ),
    size,
  );
}
