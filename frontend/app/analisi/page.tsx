"use client";

import { useState, useEffect, useMemo } from "react";
import { getPriceHistory } from "@/lib/openbb";
import {
  dailyReturns,
  annualizedVolatility,
  sharpeRatio,
  maxDrawdown,
  beta,
} from "@/lib/quant";
import { useWatchlist } from "@/components/providers/WatchlistProvider";
import QuantStatsCard from "@/components/analisi/QuantStatsCard";
import ReturnsHistogram from "@/components/analisi/ReturnsHistogram";
import VolatilityChart from "@/components/analisi/VolatilityChart";
import DrawdownChart from "@/components/analisi/DrawdownChart";
import CorrelationHeatmap from "@/components/analisi/CorrelationHeatmap";
import type { PriceBar, Timeframe } from "@/types/openbb";

const TIMEFRAMES: Timeframe[] = ["3M", "6M", "1Y", "5Y"];

export default function AnalisiPage() {
  const { tickers } = useWatchlist();
  const [selectedTicker, setSelectedTicker] = useState<string>("");
  const [timeframe, setTimeframe] = useState<Timeframe>("1Y");
  const [history, setHistory] = useState<PriceBar[]>([]);
  const [spyHistory, setSpyHistory] = useState<PriceBar[]>([]);
  const [corrSeries, setCorrSeries] = useState<{ ticker: string; closes: number[] }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tickers.length > 0 && !selectedTicker) {
      setSelectedTicker(tickers[0]);
    }
  }, [tickers]);

  useEffect(() => {
    if (!selectedTicker) return;
    setLoading(true);
    Promise.allSettled([
      getPriceHistory(selectedTicker, timeframe),
      getPriceHistory("SPY", timeframe),
    ]).then(([histResult, spyResult]) => {
      if (histResult.status === "fulfilled") setHistory(histResult.value);
      if (spyResult.status === "fulfilled") setSpyHistory(spyResult.value);
    }).finally(() => setLoading(false));
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

  const closes = history.map((b) => b.close);
  const dates = history.map((b) => b.date);
  const closesKey = closes.join(",");

  const returns = useMemo(() => dailyReturns(closes), [closesKey]);
  const spyReturns = useMemo(
    () => dailyReturns(spyHistory.map((b) => b.close)),
    [spyHistory.map((b) => b.close).join(",")]
  );

  const totalReturn =
    closes.length >= 2
      ? ((closes.at(-1)! - closes[0]) / closes[0]) * 100
      : null;
  const vol = returns.length >= 2 ? annualizedVolatility(returns) * 100 : null;
  const sharpe = returns.length >= 2 ? sharpeRatio(returns, 0.05) : null;
  const dd = closes.length >= 2 ? maxDrawdown(closes) : null;
  const betaVal =
    returns.length >= 2 && spyReturns.length >= 2
      ? beta(returns, spyReturns)
      : null;

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header + selectors */}
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
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div className="flex gap-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  tf === timeframe
                    ? "bg-accent text-white"
                    : "text-muted hover:text-white"
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
            <div
              key={i}
              className="bg-card border border-border rounded-xl p-4 animate-pulse h-20"
            />
          ))}
        </div>
      )}

      {!loading && closes.length > 0 && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-5 gap-3">
            <QuantStatsCard
              label={`Rendimento ${timeframe}`}
              value={
                totalReturn !== null
                  ? `${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(1)}%`
                  : "—"
              }
              color={
                totalReturn !== null
                  ? totalReturn >= 0
                    ? "text-positive"
                    : "text-negative"
                  : "text-white"
              }
            />
            <QuantStatsCard
              label="Volatilità Ann."
              value={vol !== null ? `${vol.toFixed(1)}%` : "—"}
            />
            <QuantStatsCard
              label="Sharpe Ratio"
              value={sharpe !== null ? sharpe.toFixed(2) : "—"}
              color="text-purple-400"
            />
            <QuantStatsCard
              label="Max Drawdown"
              value={dd !== null ? `${(dd.value * 100).toFixed(1)}%` : "—"}
              color="text-negative"
              subtext={dd ? `${dd.durationDays}gg durata` : undefined}
            />
            <QuantStatsCard
              label="Beta vs SPY"
              value={betaVal !== null ? betaVal.toFixed(2) : "N/A"}
              color="text-blue-400"
            />
          </div>

          {/* Row 1: histogram + volatility */}
          <div className="grid grid-cols-2 gap-4">
            <ReturnsHistogram closes={closes} />
            <VolatilityChart closes={closes} dates={dates} />
          </div>

          {/* Row 2: drawdown + correlation */}
          <div className="grid grid-cols-2 gap-4">
            <DrawdownChart closes={closes} dates={dates} />
            <CorrelationHeatmap series={corrSeries} />
          </div>
        </>
      )}
    </div>
  );
}
