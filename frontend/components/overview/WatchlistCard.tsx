"use client";

import Link from "next/link";
import SparklineChart from "@/components/charts/SparklineChart";
import type { Quote, PriceBar } from "@/types/openbb";

interface Props {
  quote: Quote;
  history: PriceBar[];
  onRemove: (symbol: string) => void;
}

export default function WatchlistCard({ quote, history, onRemove }: Props) {
  const positive = quote.day_change_percent >= 0;

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2">
      <div className="flex justify-between items-start">
        <Link href={`/equity/${quote.symbol}`} className="hover:text-accent">
          <span className="font-bold text-white">{quote.symbol}</span>
          {quote.name && (
            <span className="text-muted text-xs block truncate max-w-[120px]">{quote.name}</span>
          )}
        </Link>
        <button
          onClick={() => onRemove(quote.symbol)}
          className="text-muted hover:text-negative text-xs"
          aria-label={`Rimuovi ${quote.symbol}`}
        >
          ✕
        </button>
      </div>
      <SparklineChart data={history} positive={positive} />
      <div className="flex justify-between items-center">
        <span className="text-white font-semibold">${quote.price.toFixed(2)}</span>
        <span className={`text-sm font-medium ${positive ? "text-positive" : "text-negative"}`}>
          {positive ? "+" : ""}
          {quote.day_change_percent.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}
