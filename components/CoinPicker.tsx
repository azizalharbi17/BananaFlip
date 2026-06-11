"use client";

import { useEffect, useRef, useState } from "react";
import Disc from "./Disc";
import type { RankedCoin } from "@/lib/types";

interface CoinPickerProps {
  side: "A" | "B";
  coin: RankedCoin;
  /** Full ranked list — shown instantly when the menu opens with no query. */
  coins: RankedCoin[];
  onSelect: (coin: RankedCoin) => void;
}

/**
 * Coin select button + searchable dropdown. Typed queries hit
 * /api/search (debounced); the empty query lists every coin.
 */
export default function CoinPicker({ side, coin, coins, onSelect }: CoinPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RankedCoin[]>(coins);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on any click outside the picker (the reference's document listener).
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Debounced autocomplete against the internal search API.
  useEffect(() => {
    if (!open) return;
    if (!query.trim()) {
      setResults(coins);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { results: RankedCoin[] } | null) => {
          if (data) setResults(data.results);
        })
        .catch(() => {
          /* keep previous results on abort/network error */
        });
    }, 120);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, open, coins]);

  const toggle = () => {
    const next = !open;
    if (next) {
      setQuery("");
      setResults(coins);
    }
    setOpen(next);
  };

  const pick = (c: RankedCoin) => {
    setOpen(false);
    onSelect(c);
  };

  return (
    <div className="picker" data-side={side} ref={rootRef}>
      <button
        className="pick-btn"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
      >
        <Disc coin={coin} />
        <span className="pick-name">
          <b>{coin.name}</b>
          <span>{coin.symbol}</span>
        </span>
        <span className="caret">▾</span>
      </button>
      <div className={`menu${open ? " open" : ""}`} role="listbox">
        <input
          ref={inputRef}
          className="search-in"
          type="text"
          placeholder="Search coins…"
          aria-label="Search coins"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter") {
              e.preventDefault();
              if (results[0]) pick(results[0]);
            }
          }}
        />
        <ul>
          {results.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => pick(c)}>
                <Disc coin={c} />
                <span className="nm">{c.name}</span>
                <span className="tk">{c.symbol}</span>
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="empty">No matches.</li>}
        </ul>
      </div>
    </div>
  );
}
