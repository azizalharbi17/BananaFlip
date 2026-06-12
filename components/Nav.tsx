export default function Nav({ isDemoData }: { isDemoData: boolean }) {
  return (
    <nav>
      <div className="wrap nav-in">
        {/* Deliberately a plain anchor, not next/link: a classic logo
            click is a full navigation — including a real refresh with
            fresh data when already on the home page. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="brand" href="/" aria-label="BananaFlip home">
          {/* Mirrored so the banana rises left-to-right like the charts. */}
          <span className="brand-mark" aria-hidden="true">
            🍌
          </span>
          <span>
            Banana<span className="flip">Flip</span>
          </span>
        </a>
        <div className="nav-links">
          <a href="#machine">Flip</a>
          <a href="#hot">Hot flips</a>
          <a href="#roi">ROI</a>
          <a href="#moon">Moon</a>
          <a href="#dca">DCA</a>
        </div>
        {isDemoData && <span className="demo-pill">DEMO DATA</span>}
      </div>
    </nav>
  );
}
