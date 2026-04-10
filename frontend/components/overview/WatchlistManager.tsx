"use client";

import { useState } from "react";
import { useWatchlist } from "@/components/providers/WatchlistProvider";

export default function WatchlistManager() {
  const { add } = useWatchlist();
  const [input, setInput] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ticker = input.trim().toUpperCase();
    if (ticker) {
      add(ticker);
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
