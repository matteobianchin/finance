"use client";

import { useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { getPriceHistory } from "@/lib/openbb";
import type { PortfolioRow } from "@/types/openbb";

interface Props {
  rows: PortfolioRow[];
}

export default function PortfolioHistoryChart({ rows }: Props) {
  const [data, setData] = useState<{ date: string; value: number }[]>([]);
  const [costBasis, setCostBasis] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (rows.length === 0) return;

    const tickerMap = new Map<string, { quantity: number; totalCost: number }>();
    for (const row of rows) {
      const ex = tickerMap.get(row.ticker);
      if (ex) {
        ex.totalCost += row.quantity * row.buy_price;
        ex.quantity += row.quantity;
      } else {
        tickerMap.set(row.ticker, {
          quantity: row.quantity,
          totalCost: row.quantity * row.buy_price,
        });
      }
    }

    setCostBasis(
      Array.from(tickerMap.values()).reduce((s, v) => s + v.totalCost, 0)
    );

    setLoading(true);
    Promise.allSettled(
      Array.from(tickerMap.entries()).map(([ticker, { quantity }]) =>
        getPriceHistory(ticker, "1Y").then((bars) => ({ ticker, quantity, bars }))
      )
    ).then((results) => {
      const dateMap = new Map<string, number>();
      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        const { quantity, bars } = result.value;
        for (const bar of bars) {
          const date = bar.date.slice(0, 10);
          dateMap.set(date, (dateMap.get(date) ?? 0) + quantity * bar.close);
        }
      }
      const sorted = Array.from(dateMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, value]) => ({ date, value: parseFloat(value.toFixed(2)) }));
      setData(sorted);
    }).finally(() => setLoading(false));
  }, [rows.map((r) => r.ticker + r.quantity + r.buy_price).join(",")]);

  const current = data.at(-1)?.value ?? 0;
  const gain = current - costBasis;
  const gainPct = costBasis > 0 ? (gain / costBasis) * 100 : 0;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex justify-between items-start">
        <p className="text-muted text-xs uppercase tracking-wide">
          Valore Portafoglio (1Y)
        </p>
        {current > 0 && (
          <div className="text-right">
            <p className="text-white font-semibold">
              ${current.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
            <p className={`text-sm ${gain >= 0 ? "text-positive" : "text-negative"}`}>
              {gain >= 0 ? "+" : ""}
              {gain.toFixed(0)} ({gainPct.toFixed(1)}%)
            </p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-48 bg-border rounded animate-pulse" />
      ) : data.length > 0 ? (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickFormatter={(v) => v.slice(5)}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{
                background: "#1a1d27",
                border: "1px solid #2a2d3a",
                borderRadius: 8,
              }}
              formatter={(v: number) => [
                `$${v.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                "Valore",
              ]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#portfolioGrad)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-muted text-sm">Nessun dato disponibile.</p>
      )}
    </div>
  );
}
