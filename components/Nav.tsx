"use client";

import Link from "next/link";

export default function Nav({ isDemoData }: { isDemoData: boolean }) {
  return (
    <nav>
      <div className="wrap nav-in">
        <Link
          className="brand"
          href="/"
          aria-label="BananaFlip home"
          onClick={(e) => {
            // Already home → just glide back to the top.
            if (window.location.pathname === "/") {
              e.preventDefault();
              const reduced = window.matchMedia(
                "(prefers-reduced-motion: reduce)"
              ).matches;
              window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
            }
          }}
        >
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
