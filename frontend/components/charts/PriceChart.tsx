"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import type { PriceBar } from "@/types/openbb";

const TIMEFRAMES = ["1D", "1W", "1M", "3M", "6M", "1Y", "5Y"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

interface Props {
  data: PriceBar[];
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  loading?: boolean;
}

export default function PriceChart({ data, timeframe, onTimeframeChange, loading }: Props) {
  const first = data[0]?.close ?? 0;
  const last = data.at(-1)?.close ?? 0;
  const positive = last >= first;
  const color = positive ? "#22c55e" : "#ef4444";

  const chartData = data.map((d) => ({
    date: d.date.slice(0, 10),
    close: d.close,
  }));

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex gap-1 mb-4">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => onTimeframeChange(tf)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              tf === timeframe
                ? "bg-accent text-white"
                : "text-muted hover:text-white"
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-muted text-sm">
          Caricamento...
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={256}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickFormatter={(v) => v.slice(5)}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#6b7280" }}
              domain={["auto", "auto"]}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
            />
            <Tooltip
              contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }}
              labelStyle={{ color: "#e5e7eb" }}
              formatter={(v: number) => [`$${v.toFixed(2)}`, "Chiusura"]}
            />
            <Line
              type="monotone"
              dataKey="close"
              stroke={color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
