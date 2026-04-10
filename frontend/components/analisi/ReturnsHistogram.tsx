"use client";

import { useMemo } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { histogram, dailyReturns } from "@/lib/quant";

interface Props {
  closes: number[];
}

function normalPdf(x: number, mu: number, sigma: number): number {
  if (sigma === 0) return 0;
  return Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));
}

function skewness(values: number[]): number {
  const n = values.length;
  const m = values.reduce((s, v) => s + v, 0) / n;
  const s = Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / n);
  if (s === 0) return 0;
  return values.reduce((sum, v) => sum + ((v - m) / s) ** 3, 0) / n;
}

function kurtosis(values: number[]): number {
  const n = values.length;
  const m = values.reduce((s, v) => s + v, 0) / n;
  const s = Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / n);
  if (s === 0) return 0;
  return values.reduce((sum, v) => sum + ((v - m) / s) ** 4, 0) / n;
}

export default function ReturnsHistogram({ closes }: Props) {
  const returns = useMemo(() => dailyReturns(closes), [closes.join(",")]);

  const data = useMemo(() => {
    if (returns.length === 0) return [];
    const bins = histogram(returns, 25);
    const mu = returns.reduce((s, v) => s + v, 0) / returns.length;
    const sigma = Math.sqrt(returns.reduce((s, v) => s + (v - mu) ** 2, 0) / returns.length);
    const maxCount = Math.max(...bins.map((b) => b.count));
    return bins.map((b) => ({
      x: (b.x * 100).toFixed(2) + "%",
      count: b.count,
      normalScaled: normalPdf(mu, mu, sigma) > 0
        ? (normalPdf(b.x, mu, sigma) / normalPdf(mu, mu, sigma)) * maxCount
        : 0,
    }));
  }, [returns.join(",")]);

  const mu = returns.length ? returns.reduce((s, v) => s + v, 0) / returns.length : 0;
  const skew = returns.length ? skewness(returns) : 0;
  const kurt = returns.length ? kurtosis(returns) : 0;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-muted text-xs uppercase tracking-wide mb-3">
        Distribuzione Rendimenti Giornalieri
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
          <XAxis dataKey="x" tick={{ fontSize: 9, fill: "#6b7280" }} interval={4} />
          <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} />
          <Tooltip
            contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }}
            formatter={(v: number, name: string) => [
              v.toFixed(1),
              name === "count" ? "Frequenza" : "Normale",
            ]}
          />
          <Bar dataKey="count" fill="#3b82f6" opacity={0.7} isAnimationActive={false} />
          <Line
            type="monotone"
            dataKey="normalScaled"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            name="Curva normale"
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2">
        <span className="text-muted text-xs">
          Media:{" "}
          <strong className={mu >= 0 ? "text-positive" : "text-negative"}>
            {(mu * 100).toFixed(3)}%
          </strong>
        </span>
        <span className="text-muted text-xs">
          Skew: <strong className="text-white">{skew.toFixed(2)}</strong>
        </span>
        <span className="text-muted text-xs">
          Kurtosis: <strong className="text-white">{kurt.toFixed(2)}</strong>
        </span>
      </div>
    </div>
  );
}
