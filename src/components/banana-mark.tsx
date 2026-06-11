/**
 * The BananaFlip mark: a coin whose embossed face is a banana bent into a
 * swap arrow — the product in one glyph.
 */
export function BananaMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      {/* coin */}
      <circle cx="24" cy="24" r="21.5" fill="#FFE98A" stroke="#231A0E" strokeWidth="2.6" />
      <circle cx="24" cy="24" r="16.5" fill="none" stroke="#231A0E" strokeWidth="1.4" strokeDasharray="2.5 4" opacity="0.5" />
      {/* banana crescent bent into a rotation arc */}
      <path
        d="M10 21 A 15.5 15.5 0 0 0 38 21 A 21 21 0 0 1 10 21 Z"
        fill="#FFD23F"
        stroke="#231A0E"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* stem tip */}
      <circle cx="10.6" cy="21.2" r="2" fill="#5C4322" stroke="#231A0E" strokeWidth="1" />
      {/* flip arrowhead at the banana's end */}
      <path d="M38.5 21.5 L45 17.5 L43.5 25.5 Z" fill="#231A0E" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-1 font-display font-extrabold tracking-tight ${className}`}>
      <span>Banana</span>
      <span className="inline-block -rotate-3 rounded-lg border-2 border-ink bg-banana-400 px-1.5 leading-snug shadow-hard-sm">
        Flip
      </span>
    </span>
  );
}
