"use client";

import { useState, useEffect, use } from "react";
import PriceChart from "@/components/charts/PriceChart";
import SignalsPanel from "@/components/equity/SignalsPanel";
import FundamentalsTable from "@/components/equity/FundamentalsTable";
import NewsFeed from "@/components/equity/NewsFeed";
import AIAnalysisButton from "@/components/equity/AIAnalysisButton";
import { getPriceHistory, getIncomeStatement, getNews, getQuote } from "@/lib/openbb";
import type { PriceBar, IncomeStatement, NewsArticle, Quote, Timeframe } from "@/types/openbb";

export default function EquityPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = use(params);
  const symbol = ticker.toUpperCase();

  const [timeframe, setTimeframe] = useState<Timeframe>("1M");
  const [activeTab, setActiveTab] = useState<"indicatori" | "fondamentali" | "news">("indicatori");
  const [history, setHistory] = useState<PriceBar[]>([]);
  const [fundamentals, setFundamentals] = useState<IncomeStatement[]>([]);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }, [activeTab, symbol]);

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
        <AIAnalysisButton />
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
        <PriceChart
          data={history}
          timeframe={timeframe}
          onTimeframeChange={(tf) => setTimeframe(tf)}
          loading={chartLoading}
        />
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border pb-0">
        {(["indicatori", "fondamentali", "news"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
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
          <SignalsPanel data={history} />
        ) : activeTab === "fondamentali" ? (
          <FundamentalsTable data={fundamentals} />
        ) : (
          <NewsFeed articles={news} />
        )}
      </div>
    </div>
  );
}
