import Link from "next/link";

export default function Nav({ isDemoData }: { isDemoData: boolean }) {
  return (
    <nav>
      <div className="wrap nav-in">
        <Link className="brand" href="/">
          {/* Mirrored so the banana rises left-to-right like the charts. */}
          <span className="brand-mark" aria-hidden="true">
            🍌
          </span>
          <span>
            Banana<span className="flip">Flip</span>
          </span>
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
