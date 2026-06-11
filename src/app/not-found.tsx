import Link from "next/link";
import { BananaMark } from "@/components/banana-mark";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
      <BananaMark className="h-20 w-20 -rotate-12" />
      <h1 className="mt-6 font-display text-6xl font-extrabold tracking-tight">404</h1>
      <p className="mt-3 text-lg text-ink-soft">
        This page slipped on a peel. If you were chasing a flip, check the URL
        looks like{" "}
        <code className="rounded-lg bg-ink/5 px-2 py-0.5 font-mono text-sm">/pepe-flip-dogecoin</code>.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-banana">Back to the flips</Link>
        <Link href="/roi" className="btn-ghost">Try the ROI Machine</Link>
      </div>
    </div>
  );
}
