"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";

function normalPdf(x: number, mu: number, sigma: number): number {
  if (sigma === 0) return 0;
  return Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));
}

interface Props {
  histogram: { x: number; count: number }[];
  skewness: number;
  kurtosis: number;
}

export default function ReturnsHistogram({ histogram, skewness, kurtosis }: Props) {
  if (histogram.length === 0) return null;

  const total = histogram.reduce((s, b) => s + b.count, 0);
  const mu = histogram.reduce((s, b) => s + b.x * b.count, 0) / total;
  const sigma = Math.sqrt(
    histogram.reduce((s, b) => s + b.count * (b.x - mu) ** 2, 0) / total
  );
  const step = histogram.length > 1 ? histogram[1].x - histogram[0].x : 1;

  const data = histogram.map((b) => ({
    x: b.x,
    count: b.count,
    normal: normalPdf(b.x, mu, sigma) * total * step,
  }));

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-muted text-xs uppercase tracking-wide">Distribuzione Ritorni</span>
        <span className="text-muted text-xs">
          Skew: {skewness.toFixed(2)} · Kurt: {kurtosis.toFixed(2)}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
          <XAxis
            dataKey="x"
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
          />
          <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
          <Tooltip
            contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }}
            formatter={(v: number, name: string) => [
              name === "count" ? v : v.toFixed(2),
              name === "count" ? "Frequenza" : "Normale",
            ]}
          />
          <Bar dataKey="count" fill="#3b82f6" opacity={0.7} isAnimationActive={false} />
          <Line type="monotone" dataKey="normal" stroke="#f59e0b" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
