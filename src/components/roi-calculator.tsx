"use client";

import { useEffect, useMemo, useState } from "react";
import type { Coin, RoiResult } from "@/lib/types";
import {
  formatCoinAmount,
  formatDate,
  formatMultiplier,
  formatPct,
  formatUsd,
} from "@/lib/format";
import { CountUp } from "./count-up";
import { Sparkline } from "./sparkline";
import { TokenSearch } from "./token-search";

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

const AMOUNT_CHIPS = [100, 1_000, 10_000];
const DATE_CHIPS: { label: string; days: number }[] = [
  { label: "6 months ago", days: 183 },
  { label: "1 year ago", days: 365 },
  { label: "2 years ago", days: 730 },
  { label: "4 years ago", days: 1460 },
];

function verdictCopy(r: RoiResult): string {
  if (r.multiplier >= 10) return "Generational banana energy. 🍌🚀";
  if (r.multiplier >= 3) return "Extremely ripe. The group chat would never hear the end of it.";
  if (r.multiplier >= 1.5) return "Comfortably ahead of the fruit bowl.";
  if (r.multiplier >= 1) return "Slightly ripe. Beats the mattress.";
  if (r.multiplier >= 0.7) return "A little bruised, still edible.";
  return "Full banana split. Ouch. 🩹";
}

export function RoiCalculator({ defaultCoin }: { defaultCoin: Coin }) {
  const [coin, setCoin] = useState<Coin | null>(defaultCoin);
  const [amount, setAmount] = useState("1000");
  const [date, setDate] = useState(() => isoDaysAgo(365));
  const [result, setResult] = useState<RoiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const minDate = coin?.listed ?? "2013-01-01";
  const maxDate = useMemo(() => isoDaysAgo(1), []);
  const amountNum = Number(amount);
  const valid =
    coin !== null &&
    Number.isFinite(amountNum) &&
    amountNum > 0 &&
    date >= minDate &&
    date <= maxDate;

  useEffect(() => {
    if (!coin) {
      setResult(null);
      setError(null);
      return;
    }
    if (!valid) return;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/roi?coin=${encodeURIComponent(coin.id)}&amount=${amountNum}&date=${date}`,
          { signal: controller.signal },
        );
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "That one slipped. Try again.");
          setResult(null);
        } else {
          setResult(data);
          setError(null);
        }
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [coin, amountNum, date, valid]);

  const positive = (result?.profit ?? 0) >= 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[5fr_7fr]">
      {/* controls */}
      <div className="card space-y-5 p-6">
        <TokenSearch
          label="The coin 🪙"
          selected={coin}
          onSelect={setCoin}
          placeholder="Search a coin… try SOL"
        />

        <div>
          <label htmlFor="roi-amount" className="stat-label mb-1.5 block">
            The bag 💰 (USD)
          </label>
          <input
            id="roi-amount"
            type="number"
            min={1}
            max={1_000_000_000}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-2xl border-2 border-ink bg-paper p-4 font-display text-lg font-bold tabular focus:bg-banana-50"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {AMOUNT_CHIPS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(String(v))}
                className={`sticker text-xs transition-colors hover:bg-banana-300 ${
                  amountNum === v ? "bg-banana-400" : "bg-cream"
                }`}
              >
                ${v.toLocaleString("en-US")}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="roi-date" className="stat-label mb-1.5 block">
            The day you bought 📅
          </label>
          <input
            id="roi-date"
            type="date"
            min={minDate}
            max={maxDate}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-2xl border-2 border-ink bg-paper p-4 font-display text-lg font-bold focus:bg-banana-50"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {DATE_CHIPS.map((chip) => {
              const iso = isoDaysAgo(chip.days);
              const disabled = iso < minDate;
              return (
                <button
                  key={chip.days}
                  type="button"
                  disabled={disabled}
                  onClick={() => setDate(iso)}
                  className={`sticker text-xs transition-colors hover:bg-banana-300 disabled:opacity-35 disabled:hover:bg-cream ${
                    date === iso ? "bg-banana-400" : "bg-cream"
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
          {coin && (
            <p className="mt-2 text-xs text-ink-faint">
              {coin.symbol} history starts {formatDate(coin.listed)}.
            </p>
          )}
        </div>
      </div>

      {/* verdict */}
      <div className="card flex flex-col p-6 sm:p-8">
        {error ? (
          <div role="alert" className="my-auto text-center">
            <p className="text-4xl">🫠</p>
            <p className="mt-3 font-display text-lg font-bold text-bruise-600">{error}</p>
          </div>
        ) : result ? (
          <div className={`space-y-5 ${loading ? "opacity-60" : ""} transition-opacity`}>
            <div>
              <p className="stat-label">
                {formatUsd(result.invested)} of {result.coin.symbol} on {formatDate(result.date)} is
                now
              </p>
              <p
                className={`mt-1 font-display text-5xl font-extrabold leading-none tracking-tight sm:text-6xl ${
                  positive ? "text-leaf-600" : "text-bruise-600"
                }`}
              >
                <CountUp value={result.valueNow} format={formatUsd} />
              </p>
              <p className="mt-2.5 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                <span className={`sticker text-xs ${positive ? "bg-leaf-400 text-ink" : "bg-bruise-500 text-cream"}`}>
                  {formatPct(result.roiPct)} · {formatMultiplier(result.multiplier)}
                </span>
                {verdictCopy(result)}
              </p>
            </div>

            <Sparkline values={result.series.map((p) => p.value)} positive={positive} />

            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                {
                  label: "You'd hold",
                  value: `${formatCoinAmount(result.coinsBought)} ${result.coin.symbol}`,
                },
                { label: "Price then", value: formatUsd(result.priceThen) },
                { label: "Price now", value: formatUsd(result.priceNow) },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border-2 border-ink/10 bg-cream px-3 py-2.5">
                  <dt className="stat-label text-[0.62rem]">{stat.label}</dt>
                  <dd className="mt-0.5 truncate font-mono text-sm font-semibold tabular">{stat.value}</dd>
                </div>
              ))}
            </dl>

            <p className="text-xs text-ink-faint">
              Demo mode: history is a deterministic simulation anchored to today&apos;s real
              snapshot price. Live provider data plugs into the same endpoint.
            </p>
          </div>
        ) : (
          <div className="my-auto text-center">
            <p className="text-4xl">⏳</p>
            <p className="mt-3 font-display text-lg font-bold text-ink-soft">
              Pick a coin, a bag and a date.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
