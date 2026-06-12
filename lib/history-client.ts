/* Client-side access to /api/history detail payloads, shared by the ROI
   time machine and Moon math. One fetch per coin per session — every
   interaction afterwards is local math. */

export interface PricePoint {
  price: number;
  date: string;
  /** Highest daily close from this day onward ("sold the top" exit). */
  sellTop: number;
}

export interface MonthEntry extends PricePoint {
  /** Highest / lowest daily close from the entry date to today. */
  worst: PricePoint;
  best: PricePoint;
}

export interface YearDetail {
  months: Record<number, MonthEntry>;
}

export interface HistoryDetail {
  firstYear: number;
  lastYear: number;
  years: Record<number, YearDetail>;
  /** Compact daily series (post-splice): unix seconds / closes, parallel
   *  arrays — real prices for the DCA time machine. */
  seriesT: number[];
  seriesC: number[];
}

const detailCache = new Map<string, Promise<HistoryDetail | null>>();

export function loadDetail(symbol: string): Promise<HistoryDetail | null> {
  let cached = detailCache.get(symbol);
  if (!cached) {
    cached = fetch(`/api/history?symbol=${encodeURIComponent(symbol)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          d: ({ available: boolean; reason?: string } & HistoryDetail) | null
        ) => {
          if (d?.available) return d;
          // Only a confirmed "this coin has no data" is worth caching.
          // Transient upstream failures (rate limits, hiccups) must be
          // evicted, or one bad response bricks the coin all session.
          if (d?.reason !== "no-data") detailCache.delete(symbol);
          return null;
        }
      )
      .catch(() => {
        detailCache.delete(symbol); // network error — allow a retry
        return null;
      });
    detailCache.set(symbol, cached);
  }
  return cached;
}

/** First month key present in a year's data. */
export function firstMonthOf(
  detail: HistoryDetail,
  year: number,
  preferred = 1
): number {
  const months = detail.years[year]?.months ?? {};
  if (months[preferred]) return preferred;
  const keys = Object.keys(months).map(Number);
  return keys.length ? Math.min(...keys) : preferred;
}

/** Earliest available entry in the whole series. */
export function firstEntryOf(detail: HistoryDetail): MonthEntry | null {
  const yd = detail.years[detail.firstYear];
  if (!yd) return null;
  return yd.months[firstMonthOf(detail, detail.firstYear)] ?? null;
}
