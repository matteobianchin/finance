"use client";

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { useWatchlist } from "@/components/overview/WatchlistManager";
import WatchlistCard from "@/components/overview/WatchlistCard";
import WatchlistManagerForm from "@/components/overview/WatchlistManager";
import MacroWidget from "@/components/overview/MacroWidget";
import { getQuote, getPriceHistory, getFredSeries } from "@/lib/openbb";
import type { Quote, PriceBar, FredSeries } from "@/types/openbb";

interface WatchlistEntry {
  quote: Quote;
  history: PriceBar[];
}

function MacroSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
      <div className="h-3 w-20 bg-border rounded mb-3" />
      <div className="h-7 w-16 bg-border rounded" />
    </div>
  );
}

function WatchlistCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2 animate-pulse">
      <div className="flex justify-between">
        <div>
          <div className="h-4 w-12 bg-border rounded mb-1" />
          <div className="h-3 w-20 bg-border rounded" />
        </div>
        <div className="h-4 w-4 bg-border rounded" />
      </div>
      <div className="h-12 bg-border rounded" />
      <div className="flex justify-between">
        <div className="h-4 w-16 bg-border rounded" />
        <div className="h-4 w-12 bg-border rounded" />
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const { tickers, add, remove } = useWatchlist();
  const [entries, setEntries] = useState<Record<string, WatchlistEntry>>({});
  const [macroData, setMacroData] = useState<{
    fed: FredSeries[];
    treasury10y: FredSeries[];
  }>({ fed: [], treasury10y: [] });
  const [loading, setLoading] = useState(true);
  const [macroLoading, setMacroLoading] = useState(true);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      setMacroLoading(true);

      const [tickerResults, fedData, t10yData] = await Promise.allSettled([
        Promise.all(
          tickers.map(async (ticker) => {
            const [quote, history] = await Promise.all([
              getQuote(ticker),
              getPriceHistory(ticker, "1M"),
            ]);
            return { ticker, quote, history };
          })
        ),
        getFredSeries("FEDFUNDS"),
        getFredSeries("DGS10"),
      ]);

      if (tickerResults.status === "fulfilled") {
        const map: Record<string, WatchlistEntry> = {};
        tickerResults.value.forEach(({ ticker, quote, history }) => {
          map[ticker] = { quote, history };
        });
        setEntries(map);
      }

      setMacroData({
        fed: fedData.status === "fulfilled" ? fedData.value : [],
        treasury10y: t10yData.status === "fulfilled" ? t10yData.value : [],
      });

      setLoading(false);
      setMacroLoading(false);
    }

    loadAll();
  }, [tickers.join(",")]);

  const lastFed = macroData.fed.at(-1);
  const lastT10y = macroData.treasury10y.at(-1);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        <WatchlistManagerForm onAdd={add} />
      </div>

      {/* Macro widgets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {macroLoading ? (
          <>
            <MacroSkeleton />
            <MacroSkeleton />
            <MacroSkeleton />
            <MacroSkeleton />
          </>
        ) : (
          <>
            <MacroWidget
              label="Tasso FED"
              value={lastFed ? `${lastFed.value?.toFixed(2)}%` : "—"}
            />
            <MacroWidget
              label="Treasury 10Y"
              value={lastT10y ? `${lastT10y.value?.toFixed(2)}%` : "—"}
            />
            <MacroWidget label="VIX" value="—" />
            <MacroWidget label="S&P 500" value="—" />
          </>
        )}
      </div>

      {/* Watchlist */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <WatchlistCardSkeleton key={i} />
          ))}
        </div>
      ) : tickers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-xl">
          <TrendingUp size={32} className="text-muted mb-3" />
          <p className="text-white font-medium mb-1">La tua watchlist è vuota</p>
          <p className="text-muted text-sm">Aggiungi un ticker in alto a destra per iniziare a monitorare i tuoi titoli.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {tickers.map((ticker) => {
            const entry = entries[ticker];
            if (!entry) return null;
            return (
              <WatchlistCard
                key={ticker}
                quote={entry.quote}
                history={entry.history}
                onRemove={remove}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
