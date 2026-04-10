"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import type { FredSeries } from "@/types/openbb";

interface Props {
  data: FredSeries[];
  label: string;
  unit?: string;
  color?: string;
}

export default function MacroSeriesChart({ data, label, unit = "", color = "#3b82f6" }: Props) {
  const chartData = data
    .filter((d) => d.value !== null)
    .map((d) => ({ date: d.date.slice(0, 7), value: d.value as number }));

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-white font-medium mb-3">{label}</h3>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            interval={Math.floor(chartData.length / 6)}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickFormatter={(v) => `${v}${unit}`}
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }}
            formatter={(v: number) => [`${v.toFixed(2)}${unit}`, label]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
