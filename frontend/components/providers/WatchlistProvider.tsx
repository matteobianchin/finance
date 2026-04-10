"use client";

import { createContext, useContext, useState } from "react";

const DEFAULT_WATCHLIST = ["AAPL", "MSFT", "NVDA", "GOOGL"];
const STORAGE_KEY = "openbb_watchlist";

interface WatchlistContextValue {
  tickers: string[];
  add: (symbol: string) => void;
  remove: (symbol: string) => void;
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

export function WatchlistProvider({ children }: { children: React.ReactNode }) {
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

  return (
    <WatchlistContext.Provider value={{ tickers, add, remove }}>
      {children}
    </WatchlistContext.Provider>
  );
}

export function useWatchlist(): WatchlistContextValue {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error("useWatchlist deve essere usato dentro WatchlistProvider");
  return ctx;
}
