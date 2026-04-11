"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from "recharts";

interface Props {
  data: { date: string; value: number }[];
}

export default function VolatilityChart({ data }: Props) {
  if (data.length === 0) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <span className="text-muted text-xs uppercase tracking-wide">
        Volatilità Rolling 30gg (annualizzata)
      </span>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickFormatter={(v) => v.slice(5)}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
          />
          <Tooltip
            contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }}
            formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, "Volatilità"]}
          />
          <ReferenceLine y={0.2} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: "20%", fill: "#f59e0b", fontSize: 10 }} />
          <Line type="monotone" dataKey="value" stroke="#a78bfa" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
