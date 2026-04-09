"use client";

import { useState } from "react";

const DEFAULT_WATCHLIST = ["AAPL", "MSFT", "NVDA", "GOOGL"];
const STORAGE_KEY = "openbb_watchlist";

export function useWatchlist() {
  const [tickers, setTickers] = useState<string[]>(() => {
    if (typeof window === "undefined") return DEFAULT_WATCHLIST;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_WATCHLIST;
    } catch {
      return DEFAULT_WATCHLIST;
    }
  });

  function add(symbol: string) {
    const upper = symbol.toUpperCase().trim();
    if (!upper || tickers.includes(upper)) return;
    const next = [...tickers, upper];
    setTickers(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function remove(symbol: string) {
    const next = tickers.filter((t) => t !== symbol);
    setTickers(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  return { tickers, add, remove };
}

interface Props {
  onAdd: (symbol: string) => void;
}

export default function WatchlistManager({ onAdd }: Props) {
  const [input, setInput] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input.trim()) {
      onAdd(input.trim().toUpperCase());
      setInput("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Aggiungi ticker (es. TSLA)"
        className="bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-muted outline-none focus:border-accent w-48"
      />
      <button
        type="submit"
        className="bg-accent hover:bg-accent/80 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
      >
        +
      </button>
    </form>
  );
}
