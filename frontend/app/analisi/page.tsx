"use client";

import { useState, useEffect, useMemo } from "react";
import { getPriceHistory, getQuant } from "@/lib/openbb";
import { useWatchlist } from "@/components/providers/WatchlistProvider";
import QuantStatsCard from "@/components/analisi/QuantStatsCard";
import ReturnsHistogram from "@/components/analisi/ReturnsHistogram";
import VolatilityChart from "@/components/analisi/VolatilityChart";
import DrawdownChart from "@/components/analisi/DrawdownChart";
import CorrelationHeatmap from "@/components/analisi/CorrelationHeatmap";
import type { QuantResult, Timeframe } from "@/types/openbb";

const TIMEFRAMES: Timeframe[] = ["3M", "6M", "1Y", "5Y"];

export default function AnalisiPage() {
  const { tickers } = useWatchlist();
  const [selectedTicker, setSelectedTicker] = useState<string>("");
  const [timeframe, setTimeframe] = useState<Timeframe>("1Y");
  const [quant, setQuant] = useState<QuantResult | null>(null);
  const [corrSeries, setCorrSeries] = useState<{ ticker: string; closes: number[] }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tickers.length > 0 && !selectedTicker) setSelectedTicker(tickers[0]);
  }, [tickers]);

  useEffect(() => {
    if (!selectedTicker) return;
    setLoading(true);
    getQuant(selectedTicker, timeframe, "SPY")
      .then(setQuant)
      .catch(() => setQuant(null))
      .finally(() => setLoading(false));
  }, [selectedTicker, timeframe]);

  useEffect(() => {
    if (tickers.length < 2) return;
    Promise.allSettled(
      tickers.slice(0, 8).map((t) =>
        getPriceHistory(t, "1Y").then((bars) => ({
          ticker: t,
          closes: bars.map((b) => b.close),
        }))
      )
    ).then((results) => {
      setCorrSeries(
        results
          .filter(
            (r): r is PromiseFulfilledResult<{ ticker: string; closes: number[] }> =>
              r.status === "fulfilled"
          )
          .map((r) => r.value)
      );
    });
  }, [tickers.join(",")]);

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Analisi Quantitativa</h1>
        <div className="flex gap-2 items-center flex-wrap">
          <select
            value={selectedTicker}
            onChange={(e) => setSelectedTicker(e.target.value)}
            className="bg-card border border-border text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:border-accent"
          >
            {tickers.length === 0 && <option value="">—</option>}
            {tickers.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <div className="flex gap-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  tf === timeframe ? "bg-accent text-white" : "text-muted hover:text-white"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tickers.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted">
          Aggiungi ticker alla watchlist per iniziare l&apos;analisi.
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse h-20" />
          ))}
        </div>
      )}

      {!loading && quant && (
        <>
          <div className="grid grid-cols-5 gap-3">
            <QuantStatsCard
              label={`Volatilità Ann. ${timeframe}`}
              value={`${(quant.annualized_vol * 100).toFixed(1)}%`}
            />
            <QuantStatsCard
              label="Sharpe Ratio"
              value={quant.sharpe.toFixed(2)}
              color="text-purple-400"
            />
            <QuantStatsCard
              label="Sortino Ratio"
              value={quant.sortino.toFixed(2)}
              color="text-blue-400"
            />
            <QuantStatsCard
              label="Max Drawdown"
              value={`${(quant.max_drawdown.value * 100).toFixed(1)}%`}
              color="text-negative"
              subtext={`${quant.max_drawdown.duration_days}gg durata`}
            />
            <QuantStatsCard
              label="Beta vs SPY"
              value={quant.beta != null ? quant.beta.toFixed(2) : "N/A"}
              color="text-blue-400"
            />
          </div>

          {/* Row 2: new metrics */}
          <div className="grid grid-cols-4 gap-3">
            <QuantStatsCard label="VaR 95%" value={`${(quant.var_95 * 100).toFixed(2)}%`} color="text-negative" />
            <QuantStatsCard label="CVaR 95%" value={`${(quant.cvar_95 * 100).toFixed(2)}%`} color="text-negative" />
            <QuantStatsCard label="Calmar" value={quant.calmar.toFixed(2)} />
            <QuantStatsCard label="Skewness" value={quant.skewness.toFixed(2)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <ReturnsHistogram
              histogram={quant.histogram}
              skewness={quant.skewness}
              kurtosis={quant.kurtosis}
            />
            <VolatilityChart data={quant.rolling_vol} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <DrawdownChart
              data={quant.drawdown_series}
              maxDrawdownValue={quant.max_drawdown.value}
              durationDays={quant.max_drawdown.duration_days}
            />
            <CorrelationHeatmap series={corrSeries} />
          </div>
        </>
      )}
    </div>
  );
}
