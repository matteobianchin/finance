"use client";

import { useState, useEffect } from "react";
import { getAdvanced, getPortfolioOptimize } from "@/lib/openbb";
import { useWatchlist } from "@/components/providers/WatchlistProvider";
import RegimeChart from "@/components/advanced/RegimeChart";
import LinearChannelChart from "@/components/advanced/LinearChannelChart";
import EfficientFrontierChart from "@/components/advanced/EfficientFrontierChart";
import QuantStatsCard from "@/components/analisi/QuantStatsCard";
import type { AdvancedResult, PortfolioOptimizeResult, Timeframe } from "@/types/openbb";

const TIMEFRAMES: Timeframe[] = ["3M", "6M", "1Y", "5Y"];

function hurstLabel(h: number) {
  if (h < 0.45) return "Mean-reverting";
  if (h > 0.55) return "Trending";
  return "Random Walk";
}
function hurstColor(h: number) {
  if (h < 0.45) return "text-blue-400";
  if (h > 0.55) return "text-positive";
  return "text-muted";
}

function WeightsBar({ weights }: { weights: Record<string, number> }) {
  const sorted = Object.entries(weights).sort((a, b) => b[1] - a[1]);
  const COLORS = ["#a78bfa", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444",
                  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#8b5cf6"];
  return (
    <div className="space-y-1.5">
      {sorted.map(([t, w], i) => (
        <div key={t} className="flex items-center gap-2 text-xs">
          <span className="text-muted w-14 shrink-0 text-right">{t}</span>
          <div className="flex-1 bg-card-hover rounded-full h-3 overflow-hidden">
            <div
              className="h-3 rounded-full transition-all"
              style={{ width: `${(w * 100).toFixed(1)}%`, background: COLORS[i % COLORS.length] }}
            />
          </div>
          <span className="text-white w-10 text-right">{(w * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

function PortfolioCard({ label, alloc }: { label: string; alloc: import("@/types/openbb").PortfolioAllocation }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm font-semibold text-white">{label}</span>
        <div className="flex gap-3 text-xs">
          <span className={(alloc.expected_return > 0 ? "text-positive" : "text-negative")}>
            {(alloc.expected_return * 100).toFixed(1)}% ret
          </span>
          <span className="text-muted">{(alloc.volatility * 100).toFixed(1)}% vol</span>
          <span className="text-blue-400">Sharpe {alloc.sharpe.toFixed(2)}</span>
        </div>
      </div>
      <WeightsBar weights={alloc.weights} />
    </div>
  );
}

export default function AdvancedPage() {
  const { tickers } = useWatchlist();
  const [selectedTicker, setSelectedTicker] = useState("");
  const [timeframe, setTimeframe] = useState<Timeframe>("1Y");
  const [advanced, setAdvanced] = useState<AdvancedResult | null>(null);
  const [optimize, setOptimize] = useState<PortfolioOptimizeResult | null>(null);
  const [loadingAdv, setLoadingAdv] = useState(false);
  const [loadingOpt, setLoadingOpt] = useState(false);

  useEffect(() => {
    if (tickers.length > 0 && !selectedTicker) setSelectedTicker(tickers[0]);
  }, [tickers]);

  useEffect(() => {
    if (!selectedTicker) return;
    setLoadingAdv(true);
    getAdvanced(selectedTicker, timeframe)
      .then(setAdvanced)
      .catch(() => setAdvanced(null))
      .finally(() => setLoadingAdv(false));
  }, [selectedTicker, timeframe]);

  useEffect(() => {
    if (tickers.length < 2) return;
    setLoadingOpt(true);
    getPortfolioOptimize(tickers.slice(0, 12), timeframe)
      .then(setOptimize)
      .catch(() => setOptimize(null))
      .finally(() => setLoadingOpt(false));
  }, [tickers.join(","), timeframe]);

  const currentRegime = advanced?.regime_series.at(-1)?.regime ?? null;
  const REGIME_COLOR: Record<string, string> = {
    Bull: "text-positive", Bear: "text-negative",
    "High-Vol": "text-yellow-400", Neutral: "text-muted",
  };

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Analisi Avanzata</h1>
        <div className="flex gap-2 items-center flex-wrap">
          <select
            value={selectedTicker}
            onChange={(e) => setSelectedTicker(e.target.value)}
            className="bg-card border border-border text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:border-accent"
          >
            {tickers.length === 0 && <option value="">—</option>}
            {tickers.map((t) => <option key={t} value={t}>{t}</option>)}
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
          Aggiungi ticker alla watchlist per iniziare.
        </div>
      )}

      {/* ── Advanced single ticker ── */}
      {loadingAdv && (
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse h-20" />
          ))}
        </div>
      )}

      {!loadingAdv && advanced && (
        <>
          {/* Row 1: regime / mean-reversion */}
          <div className="grid grid-cols-5 gap-3">
            <QuantStatsCard
              label="Hurst Exponent"
              value={advanced.hurst.toFixed(3)}
              color={hurstColor(advanced.hurst)}
              subtext={hurstLabel(advanced.hurst)}
            />
            <QuantStatsCard
              label="O-U Half-life"
              value={advanced.ou_half_life != null ? `${advanced.ou_half_life.toFixed(1)}gg` : "N/A"}
              color={advanced.ou_half_life != null ? "text-blue-400" : "text-muted"}
              subtext={advanced.ou_half_life != null ? "mean-reversion" : "non stazionario"}
            />
            <QuantStatsCard
              label="ADF p-value"
              value={advanced.adf_pvalue != null
                ? (advanced.adf_pvalue < 0.001 ? "< 0.001" : advanced.adf_pvalue.toFixed(3))
                : "N/A"}
              color={advanced.adf_pvalue != null
                ? (advanced.adf_pvalue < 0.05 ? "text-positive" : "text-negative")
                : "text-muted"}
              subtext={advanced.adf_pvalue != null
                ? (advanced.adf_pvalue < 0.05 ? "Stazionario" : "Non stazionario")
                : ""}
            />
            <QuantStatsCard
              label="GK Volatility"
              value={`${(advanced.gk_vol * 100).toFixed(2)}%`}
              subtext="Garman-Klass OHLC"
            />
            <QuantStatsCard
              label="Kelly Criterion"
              value={`${(advanced.kelly * 100).toFixed(1)}%`}
              color={advanced.kelly > 0.2 ? "text-positive" : advanced.kelly > 0 ? "text-yellow-400" : "text-negative"}
              subtext="optimal position size"
            />
          </div>

          {/* Row 2: Pivot points */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-muted text-xs uppercase tracking-wide">Pivot Points Classici</span>
              {currentRegime && (
                <span className={`text-xs font-semibold ${REGIME_COLOR[currentRegime]}`}>
                  Regime corrente: {currentRegime}
                </span>
              )}
            </div>
            <div className="grid grid-cols-7 gap-2 text-center">
              {[
                { label: "S3", value: advanced.pivots.s3, color: "text-red-700" },
                { label: "S2", value: advanced.pivots.s2, color: "text-red-500" },
                { label: "S1", value: advanced.pivots.s1, color: "text-negative" },
                { label: "PP", value: advanced.pivots.pp, color: "text-white font-bold" },
                { label: "R1", value: advanced.pivots.r1, color: "text-positive" },
                { label: "R2", value: advanced.pivots.r2, color: "text-green-500" },
                { label: "R3", value: advanced.pivots.r3, color: "text-green-700" },
              ].map(({ label, value, color }) => (
                <div key={label} className="space-y-1">
                  <div className="text-xs text-muted">{label}</div>
                  <div className={`text-sm ${color}`}>${value.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Regime chart + Linear channel */}
          <div className="grid grid-cols-1 gap-4">
            <LinearChannelChart
              series={advanced.linear_channel.series}
              slopeAnnualized={advanced.linear_channel.slope_annualized}
              rSquared={advanced.linear_channel.r_squared}
            />
            <RegimeChart series={advanced.regime_series} />
          </div>
        </>
      )}

      {/* ── Portfolio Optimization ── */}
      <div className="mt-6">
        <h2 className="text-lg font-bold text-white mb-3">
          Ottimizzazione Portafoglio
          {tickers.length < 2 && (
            <span className="text-sm font-normal text-muted ml-2">
              (aggiungi almeno 2 ticker alla watchlist)
            </span>
          )}
        </h2>

        {loadingOpt && (
          <div className="grid grid-cols-1 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse h-32" />
            ))}
          </div>
        )}

        {!loadingOpt && optimize && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <PortfolioCard label="Max Sharpe" alloc={optimize.max_sharpe} />
              <PortfolioCard label="Min Variance" alloc={optimize.min_variance} />
              <PortfolioCard label="Risk Parity" alloc={optimize.risk_parity} />
            </div>
            <EfficientFrontierChart
              frontier={optimize.efficient_frontier}
              maxSharpe={optimize.max_sharpe}
              minVariance={optimize.min_variance}
              riskParity={optimize.risk_parity}
            />
          </div>
        )}
      </div>
    </div>
  );
}
