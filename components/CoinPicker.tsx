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
/** EVM (0x…40 hex) or Solana (base58 32–44) contract address. */
const CONTRACT_RE = /^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/;

export default function CoinPicker({ side, coin, coins, onSelect }: CoinPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RankedCoin[]>(coins);
  const [status, setStatus] = useState<"idle" | "resolving" | "not-found">("idle");
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

  // Debounced: a pasted contract address resolves live via /api/resolve
  // (any chain, any token); anything else searches our curated table.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setResults(coins);
      setStatus("idle");
      return;
    }
    const ctrl = new AbortController();
    const isAddress = CONTRACT_RE.test(q);
    setStatus(isAddress ? "resolving" : "idle");
    const timer = setTimeout(() => {
      const url = isAddress
        ? `/api/resolve?address=${encodeURIComponent(q)}`
        : `/api/search?q=${encodeURIComponent(q)}`;
      fetch(url, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { results?: RankedCoin[]; coin?: RankedCoin } | null) => {
          if (isAddress) {
            if (data?.coin) {
              setResults([data.coin]);
              setStatus("idle");
            } else {
              setResults([]);
              setStatus("not-found");
            }
          } else if (data?.results) {
            setResults(data.results);
            setStatus("idle");
          }
        })
        .catch((e) => {
          if (e?.name !== "AbortError" && isAddress) setStatus("not-found");
          /* search errors keep the previous results */
        });
    }, isAddress ? 250 : 120);
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
      setStatus("idle");
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
          placeholder="Search or paste a token address…"
          aria-label="Search coins or paste a contract address"
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
            <li key={c.slug}>
              <button type="button" onClick={() => pick(c)}>
                <Disc coin={c} />
                <span className="nm">{c.name}</span>
                <span className="rk">#{c.rank}</span>
                <span className="tk">{c.symbol}</span>
              </button>
            </li>
          ))}
          {status === "resolving" && (
            <li className="empty">Resolving token…</li>
          )}
          {status === "not-found" && (
            <li className="empty">Token not found — check the address.</li>
          )}
          {status === "idle" && results.length === 0 && query.trim() && (
            <li className="empty">No matches.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
