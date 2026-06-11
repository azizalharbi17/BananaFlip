import Link from "next/link";

export default function Nav() {
  return (
    <nav>
      <div className="wrap nav-in">
        <Link className="brand" href="/">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <path
              d="M3 16 C6 19,14 20,18 13 C19.5 10,19.5 6,18.5 4 C19 9,16 14.5,10.5 15.5 C7.5 16,4.8 15.6,3 16Z"
              fill="#f5b912"
            />
          </svg>
          Banana<span className="flip">Flip</span>
        </Link>
        <div className="nav-links">
          <a href="#machine">Flip</a>
          <a href="#hot">Hot flips</a>
          <a href="#roi">ROI</a>
        </div>
        <span className="demo-pill">DEMO DATA</span>
      </div>
    </nav>
  );
}
