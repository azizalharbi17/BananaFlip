"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animated number. Server-renders the final value (SEO keeps real numbers),
 * then rolls up from 0 / from the previous value on the client.
 */
export function CountUp({
  value,
  format,
  durationMs = 900,
  className = "",
}: {
  value: number;
  format: (n: number) => string;
  durationMs?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const prev = useRef<number | null>(null);
  const raf = useRef<number>();

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = prev.current ?? 0;
    prev.current = value;

    if (reduced || from === value) {
      setDisplay(value);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(2, -10 * t); // easeOutExpo
      setDisplay(from + (value - from) * (t === 1 ? 1 : eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, durationMs]);

  return <span className={`tabular ${className}`}>{format(display)}</span>;
}
