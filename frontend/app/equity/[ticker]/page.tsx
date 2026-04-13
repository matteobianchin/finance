"use client";

import { useState, useEffect, use, useMemo } from "react";
import PriceChart from "@/components/charts/PriceChart";
import type { EmaLine } from "@/components/charts/PriceChart";
import CandlestickChart from "@/components/charts/CandlestickChart";
import ComparisonChart from "@/components/charts/ComparisonChart";
import SignalsPanel from "@/components/equity/SignalsPanel";
import FundamentalsTable from "@/components/equity/FundamentalsTable";
import NewsFeed from "@/components/equity/NewsFeed";
import AIAnalysisPanel from "@/components/equity/AIAnalysisPanel";
import { useWatchlist } from "@/components/providers/WatchlistProvider";
import { getPriceHistory, getIncomeStatement, getNews, getQuote, getSignals } from "@/lib/openbb";
import { EMA } from "technicalindicators";
import type { PriceBar, IncomeStatement, NewsArticle, Quote, Timeframe, SignalsResult } from "@/types/openbb";

export default function EquityPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = use(params);
  const symbol = ticker.toUpperCase();

  const [timeframe, setTimeframe] = useState<Timeframe>("1M");
  const [history, setHistory] = useState<PriceBar[]>([]);
  const [fundamentals, setFundamentals] = useState<IncomeStatement[]>([]);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [signals, setSignals] = useState<SignalsResult | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { tickers: watchlist } = useWatchlist();
  const [chartMode, setChartMode] = useState<"line" | "candle">("line");
  const [activeTab, setActiveTab] = useState<"indicatori" | "fondamentali" | "news" | "confronto">(() => {
    if (typeof window === "undefined") return "indicatori";
    return (localStorage.getItem("equity_active_tab") as "indicatori" | "fondamentali" | "news" | "confronto") ?? "indicatori";
  });
  const [emaState, setEmaState] = useState<Record<number, boolean>>({
    9: false, 21: false, 50: false, 200: false,
  });

  const emaLines: EmaLine[] = useMemo(() => {
    if (history.length === 0) return [];
    const closes = history.map((b) => b.close);
    return [
      { period: 9, color: "#f59e0b" },
      { period: 21, color: "#a78bfa" },
      { period: 50, color: "#3b82f6" },
      { period: 200, color: "#6b7280" },
    ].map((cfg) => {
      const enabled = emaState[cfg.period] ?? false;
      if (closes.length < cfg.period) {
        return { ...cfg, enabled, values: closes.map(() => NaN) };
      }
      const raw = EMA.calculate({ values: closes, period: cfg.period });
      const padded = Array(closes.length - raw.length).fill(NaN).concat(raw) as number[];
      return { ...cfg, enabled, values: padded };
    });
  }, [history, emaState]);

  useEffect(() => {
    setChartLoading(true);
    setError(null);
    Promise.all([getPriceHistory(symbol, timeframe), getQuote(symbol)])
      .then(([bars, q]) => {
        setHistory(bars);
        setQuote(q);
      })
      .catch((e) => setError(e.message))
      .finally(() => setChartLoading(false));
  }, [symbol, timeframe]);

  useEffect(() => {
    if (activeTab === "indicatori") {
      setTabLoading(true);
      getSignals(symbol, timeframe)
        .then(setSignals)
        .catch(() => setSignals(null))
        .finally(() => setTabLoading(false));
    }
    if (activeTab === "fondamentali" && !fundamentals.length) {
      setTabLoading(true);
      getIncomeStatement(symbol)
        .then(setFundamentals)
        .catch(() => setFundamentals([]))
        .finally(() => setTabLoading(false));
    }
    if (activeTab === "news" && !news.length) {
      setTabLoading(true);
      getNews(symbol)
        .then(setNews)
        .catch(() => setNews([]))
        .finally(() => setTabLoading(false));
    }
  }, [activeTab, symbol, timeframe]);

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-white">{symbol}</h1>
          {quote && (
            <div className="flex items-center gap-3 mt-1">
              <span className="text-3xl font-semibold text-white">${quote.price.toFixed(2)}</span>
              <span className={`text-sm font-medium ${quote.day_change_percent >= 0 ? "text-positive" : "text-negative"}`}>
                {quote.day_change_percent >= 0 ? "+" : ""}
                {quote.day_change_percent.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
        <AIAnalysisPanel ticker={symbol} />
      </div>

      {error && (
        <div className="bg-negative/10 border border-negative/30 rounded-lg p-3 text-negative text-sm">
          Dati non disponibili: {error}
        </div>
      )}

      {/* Grafico prezzi */}
      {chartLoading && !history.length ? (
        <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
          <div className="flex gap-1 mb-4">
            {["1D","1W","1M","3M","6M","1Y","5Y"].map((tf) => (
              <div key={tf} className="h-6 w-8 bg-border rounded" />
            ))}
          </div>
          <div className="h-64 bg-border rounded" />
        </div>
      ) : (
        <div>
          <div className="flex justify-end gap-1 mb-2">
            {(["line", "candle"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setChartMode(mode)}
                className={`px-3 py-1 rounded text-xs transition-colors ${
                  chartMode === mode
                    ? "bg-accent text-white"
                    : "text-muted hover:text-white bg-card border border-border"
                }`}
              >
                {mode === "line" ? "Linea" : "Candele"}
              </button>
            ))}
          </div>
          {chartMode === "line" ? (
            <PriceChart
              data={history}
              timeframe={timeframe}
              onTimeframeChange={(tf) => setTimeframe(tf)}
              loading={chartLoading}
              emaLines={emaLines}
              onToggleEma={(period) =>
                setEmaState((prev) => ({ ...prev, [period]: !prev[period] }))
              }
            />
          ) : (
            <CandlestickChart
              data={history}
              timeframe={timeframe}
              onTimeframeChange={(tf) => setTimeframe(tf)}
              loading={chartLoading}
            />
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border pb-0">
        {(["indicatori", "fondamentali", "news", "confronto"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              localStorage.setItem("equity_active_tab", tab);
              setActiveTab(tab);
            }}
            className={`px-4 py-2 text-sm capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-accent text-white font-medium"
                : "border-transparent text-muted hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-64">
        {tabLoading ? (
          <p className="text-muted text-sm">Caricamento...</p>
        ) : activeTab === "indicatori" ? (
          signals ? (
            <SignalsPanel signals={signals} />
          ) : (
            <p className="text-muted text-sm">Caricamento indicatori...</p>
          )
        ) : activeTab === "fondamentali" ? (
          <FundamentalsTable data={fundamentals} />
        ) : activeTab === "confronto" ? (
          <ComparisonChart
            primaryTicker={symbol}
            watchlist={watchlist}
            timeframe={timeframe}
          />
        ) : (
          <NewsFeed articles={news} />
        )}
      </div>
    </div>
  );
}
