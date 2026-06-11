export default function Hero() {
  return (
    <header className="hero wrap">
      <div>
        <h1>
          Can it <span className="gold">flip</span>?<br />
          Run the market-cap math.
        </h1>
        <p>
          Pick a challenger and a target. BananaFlip shows the challenger&apos;s price at
          the target&apos;s market cap — and how many ×&apos;s away the flippening is.
        </p>
      </div>
      {/* signature: banana drawn as an ascending candlestick arc */}
      <svg
        className="candle-banana"
        width="240"
        height="170"
        viewBox="0 0 240 170"
        fill="none"
        aria-hidden="true"
      >
        <g stroke="#f5b912" strokeWidth="2">
          <line x1="28" y1="118" x2="28" y2="160" />
          <line x1="62" y1="92" x2="62" y2="140" />
          <line x1="96" y1="68" x2="96" y2="118" />
          <line x1="130" y1="48" x2="130" y2="98" />
          <line x1="164" y1="34" x2="164" y2="80" />
          <line x1="198" y1="28" x2="198" y2="64" />
        </g>
        <g>
          <rect x="20" y="126" width="16" height="26" rx="3" fill="#f5b912" />
          <rect x="54" y="102" width="16" height="28" rx="3" fill="#f5b912" />
          <rect x="88" y="78" width="16" height="30" rx="3" fill="#ffd45e" />
          <rect x="122" y="58" width="16" height="30" rx="3" fill="#ffd45e" />
          <rect x="156" y="42" width="16" height="28" rx="3" fill="#ffe9a8" />
          <rect x="190" y="34" width="16" height="22" rx="3" fill="#ffe9a8" />
        </g>
        <path
          d="M14 150 C60 158,150 120,206 40"
          stroke="#6b6048"
          strokeDasharray="3 5"
          strokeWidth="1.5"
        />
      </svg>
    </header>
  );
}
