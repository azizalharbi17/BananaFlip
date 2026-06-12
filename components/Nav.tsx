import Link from "next/link";

/**
 * The BananaZone mark: a banana drawn as a rising arc (up-only candle),
 * gold body with a lighter inner highlight, flat-cut stem at the lower
 * tip and a dark nub at the upper tip. Tuned to stay legible at 22px.
 */
export function BananaMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M3.6 17 C7.6 20.2, 14 19.4, 17.4 15.2 C19.6 12.5, 20.4 8.5, 20 4.7 L18.5 4.6 C18.3 8.3, 16.7 11.5, 13.9 13.6 C10.9 15.8, 6.9 16, 4.3 14.9 Z"
        fill="#f5b912"
      />
      <path
        d="M4.7 14.7 C7.6 15.8, 11.2 15.3, 13.9 13.3 C16.5 11.4, 18.1 8.4, 18.4 5.2 C17.5 8.9, 15.5 12, 12.5 14 C9.9 15.6, 6.9 15.6, 4.7 14.7 Z"
        fill="#ffd45e"
      />
      <path d="M2.9 15.9 L4.5 14.7 L5.4 16.1 L4 17.4 Z" fill="#c98f0a" />
      <ellipse cx="19.4" cy="4.8" rx="1.15" ry="1.05" fill="#8a6206" />
    </svg>
  );
}

export default function Nav({ isDemoData }: { isDemoData: boolean }) {
  return (
    <nav>
      <div className="wrap nav-in">
        <Link className="brand" href="/">
          <BananaMark />
          Banana<span className="flip">Flip</span>
        </Link>
        <div className="nav-links">
          <a href="#machine">Flip</a>
          <a href="#hot">Hot flips</a>
          <a href="#roi">ROI</a>
        </div>
        {isDemoData && <span className="demo-pill">DEMO DATA</span>}
      </div>
    </nav>
  );
}
