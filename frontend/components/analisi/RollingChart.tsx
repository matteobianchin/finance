"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from "recharts";

interface Props {
  data: { date: string; value: number }[];
  label: string;
  color?: string;
  referenceLines?: number[];
  formatter?: (v: number) => string;
}

export default function RollingChart({
  data,
  label,
  color = "#a78bfa",
  referenceLines = [],
  formatter = (v) => v.toFixed(2),
}: Props) {
  if (!data.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <span className="text-muted text-xs uppercase tracking-wide">{label}</span>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickFormatter={(v) => v.slice(5)}
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} tickFormatter={formatter} />
          <Tooltip
            contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }}
            formatter={(v: number) => [formatter(v), label]}
          />
          {referenceLines.map((y) => (
            <ReferenceLine key={y} y={y} stroke="#6b7280" strokeDasharray="3 3" />
          ))}
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
