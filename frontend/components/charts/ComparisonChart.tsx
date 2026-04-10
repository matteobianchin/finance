"use client";

import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { getPriceHistory } from "@/lib/openbb";
import type { Timeframe } from "@/types/openbb";

const COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#a78bfa",
  "#ec4899", "#ef4444", "#14b8a6", "#f97316",
];

interface Props {
  primaryTicker: string;
  watchlist: string[];
  timeframe: Timeframe;
}

export default function ComparisonChart({ primaryTicker, watchlist, timeframe }: Props) {
  const [chartData, setChartData] = useState<Record<string, number | string>[]>([]);
  const [activeTickers, setActiveTickers] = useState<string[]>([primaryTicker]);
  const [loading, setLoading] = useState(false);

  const candidates = [
    primaryTicker,
    ...watchlist.filter((t) => t !== primaryTicker),
  ].slice(0, 8);

  useEffect(() => {
    setActiveTickers([primaryTicker]);
  }, [primaryTicker]);

  useEffect(() => {
    if (activeTickers.length === 0) return;
    setLoading(true);

    Promise.allSettled(
      activeTickers.map((t) =>
        getPriceHistory(t, timeframe).then((bars) => ({ ticker: t, bars }))
      )
    ).then((results) => {
      const seriesMap: Record<string, Record<string, number>> = {};

      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        const { ticker, bars } = result.value;
        if (bars.length === 0) continue;
        const base = bars[0].close;
        for (const bar of bars) {
          const date = bar.date.slice(0, 10);
          if (!seriesMap[date]) seriesMap[date] = {};
          seriesMap[date][ticker] = parseFloat(
            (((bar.close - base) / base) * 100).toFixed(2)
          );
        }
      }

      const sorted = Object.entries(seriesMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, values]) => ({ date, ...values }));

      setChartData(sorted);
    }).finally(() => setLoading(false));
  }, [activeTickers.join(","), timeframe]);

  function toggle(ticker: string) {
    setActiveTickers((prev) =>
      prev.includes(ticker)
        ? prev.filter((t) => t !== ticker)
        : [...prev, ticker]
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <p className="text-muted text-xs uppercase tracking-wide">
        Confronto Performance (base = 0%)
      </p>

      <div className="flex flex-wrap gap-2">
        {candidates.map((t, i) => {
          const active = activeTickers.includes(t);
          const color = COLORS[i % COLORS.length];
          return (
            <button
              key={t}
              onClick={() => toggle(t)}
              style={{
                borderColor: color,
                color: active ? "#fff" : color,
                background: active ? color + "33" : "transparent",
              }}
              className="px-2 py-0.5 rounded text-xs border transition-colors font-medium"
            >
              {t}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="h-48 bg-border rounded animate-pulse" />
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickFormatter={(v) => v.slice(5)}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                background: "#1a1d27",
                border: "1px solid #2a2d3a",
                borderRadius: 8,
              }}
              formatter={(v: number, name: string) => [
                `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`,
                name,
              ]}
            />
            {activeTickers.map((ticker) => (
              <Line
                key={ticker}
                type="monotone"
                dataKey={ticker}
                stroke={COLORS[candidates.indexOf(ticker) % COLORS.length]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
