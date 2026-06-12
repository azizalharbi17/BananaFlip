import { discTextColor, fmtX } from "./format";
import type { RankedCoin } from "./types";

/* Shared building blocks for the OG/Twitter card images (next/og).
   Satori rules apply: every multi-child <div> needs display:flex, and
   fonts fall back to the built-in sans — the house look is carried by
   the palette, wordmark two-tone and banana mark. */

export const OG_SIZE = { width: 1200, height: 630 };

const C = {
  bg: "#0a0800",
  panel: "#13100a",
  line: "#2b2210",
  gold: "#f5b912",
  text: "#f3eddd",
  muted: "#9b8d68",
  faint: "#6b6048",
  grad: "linear-gradient(135deg, #ffd45e 0%, #f0a90a 100%)",
  ink: "#1a1402",
};

/** The nav banana, scaled up as a faint corner watermark. */
function BananaWatermark() {
  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        right: -70,
        bottom: -110,
        opacity: 0.1,
        transform: "rotate(-10deg)",
      }}
    >
      <svg width="560" height="560" viewBox="0 0 22 22">
        <path
          d="M3.6 17 C7.6 20.2, 14 19.4, 17.4 15.2 C19.6 12.5, 20.4 8.5, 20 4.7 L18.5 4.6 C18.3 8.3, 16.7 11.5, 13.9 13.6 C10.9 15.8, 6.9 16, 4.3 14.9 Z"
          fill={C.gold}
        />
        <path
          d="M4.7 14.7 C7.6 15.8, 11.2 15.3, 13.9 13.3 C16.5 11.4, 18.1 8.4, 18.4 5.2 C17.5 8.9, 15.5 12, 12.5 14 C9.9 15.6, 6.9 15.6, 4.7 14.7 Z"
          fill="#ffd45e"
        />
      </svg>
    </div>
  );
}

function Glow() {
  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        top: -260,
        left: 240,
        width: 720,
        height: 520,
        background:
          "radial-gradient(circle at 50% 50%, rgba(245,185,18,0.16), rgba(245,185,18,0))",
      }}
    />
  );
}

function Wordmark({ size }: { size: number }) {
  return (
    <div
      style={{
        display: "flex",
        fontSize: size,
        fontWeight: 700,
        letterSpacing: -1,
      }}
    >
      <span style={{ color: "#ffffff" }}>Banana</span>
      <span
        style={{
          backgroundImage: C.grad,
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        Flip
      </span>
    </div>
  );
}

function Footer() {
  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        bottom: 38,
        left: 0,
        right: 0,
        justifyContent: "center",
        fontSize: 22,
        letterSpacing: 8,
        color: C.faint,
      }}
    >
      BANANAFLIP.IO
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: C.bg,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Glow />
      <BananaWatermark />
      {children}
      <Footer />
    </div>
  );
}

/** The site-wide card. */
export function RootCard() {
  return (
    <Frame>
      <Wordmark size={118} />
      <div
        style={{
          display: "flex",
          marginTop: 22,
          fontSize: 36,
          color: C.muted,
          letterSpacing: 2,
        }}
      >
        The flippening calculator
      </div>
    </Frame>
  );
}

function Disc({ coin, size }: { coin: RankedCoin; size: number }) {
  return (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        borderRadius: size,
        background: coin.color,
        color: discTextColor(coin.color),
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.34,
        fontWeight: 700,
        border: "3px solid rgba(255,255,255,0.14)",
      }}
    >
      {coin.symbol.slice(0, 2)}
    </div>
  );
}

/** The per-pair matchup card: "PEPE flips? DOGE · needs 10.9×". */
export function PairCard({ a, b }: { a: RankedCoin; b: RankedCoin }) {
  const multiplier = b.marketCap / a.marketCap;
  const alreadyFlipped = multiplier < 1;
  return (
    <Frame>
      <div style={{ display: "flex", position: "absolute", top: 44 }}>
        <Wordmark size={44} />
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 30,
        }}
      >
        <Disc coin={a} size={130} />
        <span style={{ fontSize: 92, fontWeight: 700, color: "#ffffff" }}>
          {a.symbol}
        </span>
        <span style={{ fontSize: 40, color: C.faint }}>flips?</span>
        <span style={{ fontSize: 92, fontWeight: 700, color: "#ffffff" }}>
          {b.symbol}
        </span>
        <Disc coin={b} size={130} />
      </div>
      <div style={{ display: "flex", marginTop: 46 }}>
        {alreadyFlipped ? (
          <div
            style={{
              display: "flex",
              background: C.panel,
              border: `2px solid ${C.line}`,
              color: C.muted,
              borderRadius: 999,
              padding: "16px 42px",
              fontSize: 44,
              fontWeight: 700,
            }}
          >
            already flipped
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              backgroundImage: C.grad,
              color: C.ink,
              borderRadius: 999,
              padding: "16px 42px",
              fontSize: 44,
              fontWeight: 700,
            }}
          >
            needs {fmtX(multiplier)}
          </div>
        )}
      </div>
    </Frame>
  );
}
