import Link from "next/link";
import { BananaMark, Wordmark } from "./banana-mark";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink bg-cream/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="BananaFlip home">
          <span className="transition-transform duration-300 group-hover:rotate-[180deg]">
            <BananaMark className="h-9 w-9" />
          </span>
          <Wordmark className="text-xl" />
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main">
          <Link
            href="/#trending"
            className="rounded-xl px-3 py-2 font-display text-sm font-bold text-ink-soft transition-colors hover:bg-banana-100 hover:text-ink"
          >
            Trending
          </Link>
          <Link
            href="/roi"
            className="rounded-xl px-3 py-2 font-display text-sm font-bold text-ink-soft transition-colors hover:bg-banana-100 hover:text-ink"
          >
            ROI&nbsp;Machine
          </Link>
          <Link href="/#flip" className="btn-banana hidden px-4 py-2 text-sm sm:inline-flex">
            Flip a coin
          </Link>
        </nav>
      </div>
    </header>
  );
}
