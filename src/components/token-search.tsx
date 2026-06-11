"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Coin } from "@/lib/types";
import { formatCompactUsd, formatUsd } from "@/lib/format";
import { CoinLogo } from "./coin-logo";

/**
 * Autocomplete combobox backed by /api/search.
 * Empty focus shows the top coins; full keyboard support.
 */
export function TokenSearch({
  label,
  selected,
  onSelect,
  excludeId,
  placeholder = "Search 50 coins…",
}: {
  label: string;
  selected: Coin | null;
  onSelect: (coin: Coin | null) => void;
  excludeId?: string;
  placeholder?: string;
}) {
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Coin[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(
    async (q: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=9`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data: { results: Coin[] } = await res.json();
        setItems(data.results.filter((c) => c.id !== excludeId).slice(0, 8));
        setHighlight(0);
      } catch {
        /* aborted or offline — keep previous items */
      }
    },
    [excludeId],
  );

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => search(query), query ? 140 : 0);
    return () => clearTimeout(t);
  }, [query, open, search]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const pick = (coin: Coin) => {
    onSelect(coin);
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[highlight]) pick(items[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  if (selected) {
    return (
      <div>
        <p className="stat-label mb-1.5">{label}</p>
        <div className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-paper p-3 shadow-hard-sm">
          <CoinLogo coin={selected} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-extrabold leading-tight">
              {selected.symbol}
              <span className="ml-2 text-sm font-bold text-ink-faint">{selected.name}</span>
            </p>
            <p className="font-mono text-sm text-ink-soft tabular">
              {formatUsd(selected.price)}
              <span className="mx-1.5 text-ink-faint">·</span>
              {formatCompactUsd(selected.market_cap)} cap
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            aria-label={`Remove ${selected.name}`}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-ink/20 font-bold text-ink-faint transition-colors hover:border-ink hover:bg-banana-100 hover:text-ink"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <p className="stat-label mb-1.5">{label}</p>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full rounded-2xl border-2 border-ink bg-paper p-4 font-display text-lg font-bold placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:text-ink-faint focus:bg-banana-50"
      />
      {open && items.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-2 max-h-80 w-full overflow-auto rounded-2xl border-2 border-ink bg-paper p-1.5 shadow-hard"
        >
          {items.map((coin, i) => (
            <li key={coin.id} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(coin)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  i === highlight ? "bg-banana-200" : ""
                }`}
              >
                <CoinLogo coin={coin} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display font-extrabold leading-tight">
                    {coin.symbol}
                    <span className="ml-2 text-xs font-bold text-ink-faint">{coin.name}</span>
                  </span>
                  <span className="block font-mono text-xs text-ink-soft tabular">
                    {formatUsd(coin.price)} · {formatCompactUsd(coin.market_cap)} cap
                  </span>
                </span>
                <span className="sticker bg-cream text-[0.65rem]">#{coin.rank}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && query && items.length === 0 && (
        <div className="absolute z-30 mt-2 w-full rounded-2xl border-2 border-ink bg-paper p-4 text-sm text-ink-soft shadow-hard">
          No coins match “{query}”. The bunch only holds the top 50 (for now).
        </div>
      )}
    </div>
  );
}
