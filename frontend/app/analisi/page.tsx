"use client";

import { useState, useEffect } from "react";
import { getPriceHistory, getQuant } from "@/lib/openbb";
import { useWatchlist } from "@/components/providers/WatchlistProvider";
import QuantStatsCard from "@/components/analisi/QuantStatsCard";
import ReturnsHistogram from "@/components/analisi/ReturnsHistogram";
import VolatilityChart from "@/components/analisi/VolatilityChart";
import DrawdownChart from "@/components/analisi/DrawdownChart";
import CorrelationHeatmap from "@/components/analisi/CorrelationHeatmap";
import RollingChart from "@/components/analisi/RollingChart";
import SectionToggle from "@/components/ui/SectionToggle";
import type { QuantResult, Timeframe } from "@/types/openbb";

const TIMEFRAMES: Timeframe[] = ["3M", "6M", "1Y", "5Y"];

function pct(v: number) { return `${(v * 100).toFixed(2)}%`; }
function fmt(v: number, d = 2) { return v.toFixed(d); }
function colorRatio(v: number) {
  if (v > 1) return "text-positive";
  if (v < 0) return "text-negative";
  return "text-white";
}
function colorVal(v: number) {
  return v > 0 ? "text-positive" : v < 0 ? "text-negative" : "text-white";
}

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
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Analisi Quantitativa</h1>
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
          Aggiungi ticker alla watchlist per iniziare l&apos;analisi.
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse h-20" />
          ))}
        </div>
      )}

      {!loading && quant && (
        <div className="space-y-5">

          {/* ── Rischio & Rendimento ── */}
          <SectionToggle title="Rischio & Rendimento" badge="vol · sharpe · sortino · drawdown · beta">
            <div className="grid grid-cols-5 gap-3">
              <QuantStatsCard
                label={`Volatilità Ann. ${timeframe}`}
                value={pct(quant.annualized_vol)}
              />
              <QuantStatsCard
                label="Sharpe Ratio"
                value={fmt(quant.sharpe)}
                color={colorRatio(quant.sharpe)}
              />
              <QuantStatsCard
                label="Sortino Ratio"
                value={fmt(quant.sortino)}
                color={colorRatio(quant.sortino)}
              />
              <QuantStatsCard
                label="Max Drawdown"
                value={pct(quant.max_drawdown.value)}
                color="text-negative"
                subtext={`${quant.max_drawdown.duration_days}gg durata`}
              />
              <QuantStatsCard
                label="Beta vs SPY"
                value={quant.beta != null ? fmt(quant.beta) : "N/A"}
                color="text-blue-400"
              />
            </div>

            {/* Tail risk */}
            <div className="grid grid-cols-5 gap-3">
              <QuantStatsCard label="VaR 95%"  value={pct(quant.var_95)}  color="text-negative" />
              <QuantStatsCard label="CVaR 95%" value={pct(quant.cvar_95)} color="text-negative" />
              <QuantStatsCard label="VaR 99%"  value={pct(quant.var_99)}  color="text-negative" />
              <QuantStatsCard label="CVaR 99%" value={pct(quant.cvar_99)} color="text-negative" />
              <QuantStatsCard
                label="Tail Ratio"
                value={fmt(quant.tail_ratio)}
                color={colorRatio(quant.tail_ratio)}
                subtext="p95 / |p5|"
              />
            </div>
          </SectionToggle>

          {/* ── Performance ── */}
          <SectionToggle title="Performance" badge="calmar · omega · win rate · payoff">
            <div className="grid grid-cols-5 gap-3">
              <QuantStatsCard
                label="Calmar"
                value={fmt(quant.calmar)}
                color={colorRatio(quant.calmar)}
              />
              <QuantStatsCard
                label="Omega Ratio"
                value={quant.omega_ratio === Infinity ? "∞" : fmt(quant.omega_ratio)}
                color={colorRatio(quant.omega_ratio)}
              />
              <QuantStatsCard
                label="Gain-to-Pain"
                value={fmt(quant.gain_to_pain)}
                color={colorRatio(quant.gain_to_pain)}
              />
              <QuantStatsCard
                label="Win Rate"
                value={pct(quant.win_rate)}
                color={quant.win_rate > 0.5 ? "text-positive" : "text-negative"}
              />
              <QuantStatsCard
                label="Payoff Ratio"
                value={fmt(quant.payoff_ratio)}
                color={colorRatio(quant.payoff_ratio)}
                subtext="avg win / avg loss"
              />
            </div>
          </SectionToggle>

          {/* ── vs Benchmark ── */}
          {(quant.information_ratio != null || quant.treynor != null) && (
            <SectionToggle title="vs Benchmark (SPY)" badge="IR · treynor · alpha · recovery">
              <div className="grid grid-cols-5 gap-3">
                <QuantStatsCard
                  label="Information Ratio"
                  value={quant.information_ratio != null ? fmt(quant.information_ratio) : "N/A"}
                  color={quant.information_ratio != null ? colorVal(quant.information_ratio) : "text-muted"}
                  subtext="vs benchmark"
                />
                <QuantStatsCard
                  label="Treynor"
                  value={quant.treynor != null ? fmt(quant.treynor) : "N/A"}
                  color={quant.treynor != null ? colorRatio(quant.treynor) : "text-muted"}
                  subtext="return / beta"
                />
                <QuantStatsCard
                  label="Jensen's Alpha"
                  value={quant.jensens_alpha != null ? `${(quant.jensens_alpha * 100).toFixed(2)}%` : "N/A"}
                  color={quant.jensens_alpha != null ? colorVal(quant.jensens_alpha) : "text-muted"}
                />
                <QuantStatsCard
                  label="Recovery"
                  value={quant.recovery_days != null ? `${quant.recovery_days}gg` : "In corso"}
                  color={quant.recovery_days != null ? "text-positive" : "text-negative"}
                  subtext="dal trough al peak"
                />
                <QuantStatsCard
                  label="Ulcer Index"
                  value={fmt(quant.ulcer_index)}
                  subtext="drawdown pesato"
                />
              </div>
            </SectionToggle>
          )}

          {/* ── Distribuzione ── */}
          <SectionToggle title="Distribuzione dei ritorni" badge="skew · kurtosis · JB · autocorr" defaultOpen={false}>
            <div className="grid grid-cols-5 gap-3">
              <QuantStatsCard
                label="Skewness"
                value={fmt(quant.skewness)}
                color={quant.skewness > 0 ? "text-positive" : "text-negative"}
                subtext={quant.skewness > 0.5 ? "Coda destra" : quant.skewness < -0.5 ? "Coda sinistra" : "Simmetrica"}
              />
              <QuantStatsCard
                label="Kurtosis"
                value={fmt(quant.kurtosis)}
                subtext={quant.kurtosis > 3 ? "Leptocurtica (fat tail)" : "Normale"}
              />
              <QuantStatsCard
                label="Jarque-Bera p"
                value={quant.jb_pvalue < 0.001 ? "< 0.001" : fmt(quant.jb_pvalue, 3)}
                color={quant.jb_pvalue < 0.05 ? "text-negative" : "text-positive"}
                subtext={quant.jb_pvalue < 0.05 ? "Non normale" : "Normale (p>0.05)"}
              />
              <QuantStatsCard
                label="Autocorr. (lag 1)"
                value={fmt(quant.autocorr_lag1)}
                color={colorVal(quant.autocorr_lag1)}
                subtext={quant.autocorr_lag1 > 0.1 ? "Momentum" : quant.autocorr_lag1 < -0.1 ? "Mean-rev." : "Neutrale"}
              />
              <QuantStatsCard
                label="MAD Vol"
                value={pct(quant.mad_vol)}
                subtext="volatilità robusta"
              />
            </div>
          </SectionToggle>

          {/* ── Grafici ── */}
          <SectionToggle title="Grafici" badge="hist · vol · drawdown · sharpe · beta · corr · heatmap">
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
              <RollingChart
                data={quant.rolling_sharpe}
                label="Sharpe Rolling 30gg"
                color="#a78bfa"
                referenceLines={[0, 1]}
                formatter={(v) => v.toFixed(2)}
              />
            </div>

            {(quant.rolling_beta || quant.rolling_corr) && (
              <div className="grid grid-cols-2 gap-4">
                {quant.rolling_beta && (
                  <RollingChart
                    data={quant.rolling_beta}
                    label="Beta Rolling 30gg vs SPY"
                    color="#3b82f6"
                    referenceLines={[0, 1]}
                    formatter={(v) => v.toFixed(2)}
                  />
                )}
                {quant.rolling_corr && (
                  <RollingChart
                    data={quant.rolling_corr}
                    label="Correlazione Rolling 30gg vs SPY"
                    color="#22c55e"
                    referenceLines={[0, 0.5, -0.5]}
                    formatter={(v) => v.toFixed(2)}
                  />
                )}
              </div>
            )}

            <CorrelationHeatmap series={corrSeries} />
          </SectionToggle>

        </div>
      )}
    </div>
  );
}
