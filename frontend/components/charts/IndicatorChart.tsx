"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

interface DataPoint {
  date: string;
  value: number;
}

interface Props {
  data: DataPoint[];
  label: string;
  color?: string;
  referenceLines?: number[];
  domain?: [number | "auto", number | "auto"];
}

export default function IndicatorChart({
  data,
  label,
  color = "#3b82f6",
  referenceLines = [],
  domain = ["auto", "auto"],
}: Props) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <span className="text-muted text-xs uppercase tracking-wide">{label}</span>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} tickFormatter={(v) => v.slice(5)} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} domain={domain} />
          <Tooltip
            contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }}
            formatter={(v: number) => [v.toFixed(2), label]}
          />
          {referenceLines.map((val) => (
            <ReferenceLine key={val} y={val} stroke="#6b7280" strokeDasharray="4 4" />
          ))}
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
