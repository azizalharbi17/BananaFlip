"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animated count-up ported from design-reference.html: 420ms cubic
 * ease-out from 0 to `target`. Animates only when `pulse` changes
 * (the reference's render(true)); otherwise updates statically. Respects
 * prefers-reduced-motion. Server render shows the final value.
 */
export function useCountUp(
  target: number,
  fmt: (v: number) => string,
  pulse: number
): string {
  const [text, setText] = useState(() => fmt(target));
  const lastPulse = useRef(pulse);

  useEffect(() => {
    const animate =
      pulse !== lastPulse.current &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    lastPulse.current = pulse;

    if (!animate) {
      setText(fmt(target));
      return;
    }

    const t0 = performance.now();
    const DURATION = 420;
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / DURATION);
      const eased = 1 - Math.pow(1 - k, 3);
      setText(fmt(target * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, fmt, pulse]);

  return text;
}
