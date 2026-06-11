/**
 * Number formatting tuned for crypto: micro-cap prices need significant
 * digits ($0.0000131), large numbers want compact notation ($1.9T).
 */

export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1) {
    return value.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (abs === 0) return "$0.00";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumSignificantDigits: 3,
  });
}

export function formatCompactUsd(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  });
}

export function formatMultiplier(x: number): string {
  if (!Number.isFinite(x)) return "—";
  if (x >= 1000) return `${Math.round(x).toLocaleString("en-US")}×`;
  if (x >= 100) return `${x.toFixed(0)}×`;
  if (x >= 10) return `${x.toFixed(1)}×`;
  return `${x.toFixed(2)}×`;
}

export function formatPct(value: number, signed = true): string {
  if (!Number.isFinite(value)) return "—";
  const sign = signed && value > 0 ? "+" : "";
  const digits = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatCoinAmount(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1000) {
    return value.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 2 });
  }
  if (value >= 1) return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return value.toLocaleString("en-US", { maximumSignificantDigits: 4 });
}

export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
