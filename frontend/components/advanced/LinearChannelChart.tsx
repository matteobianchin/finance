"use client";

import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import type { LinearChannelPoint } from "@/types/openbb";

interface Props {
  series: LinearChannelPoint[];
  slopeAnnualized: number;
  rSquared: number;
}

export default function LinearChannelChart({ series, slopeAnnualized, rSquared }: Props) {
  if (!series.length) return null;

  // Downsample for performance (max 300 points)
  const step = Math.max(1, Math.floor(series.length / 300));
  const data = series.filter((_, i) => i % step === 0 || i === series.length - 1);

  const slopeColor = slopeAnnualized > 0 ? "text-positive" : "text-negative";
  const slopePct = `${(slopeAnnualized * 100).toFixed(1)}%`;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-muted text-xs uppercase tracking-wide">Canale Regressione Lineare (±2σ)</span>
        <div className="flex gap-4 text-xs">
          <span>Trend: <span className={slopeColor}>{slopePct}/anno</span></span>
          <span className="text-muted">R² {rSquared.toFixed(3)}</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickFormatter={(v) => v.slice(5)}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#6b7280" }}
            domain={["auto", "auto"]}
            tickFormatter={(v) => `$${v.toFixed(0)}`}
          />
          <Tooltip
            contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }}
            formatter={(v: number, name: string) => {
              const labels: Record<string, string> = {
                price: "Price",
                mid: "Trend",
                band: "Canale",
              };
              return [`$${v.toFixed(2)}`, labels[name] ?? name];
            }}
          />
          {/* ±2σ band as filled area between lower and upper */}
          <Area
            type="monotone"
            dataKey="upper"
            stroke="none"
            fill="#3b82f622"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="lower"
            stroke="none"
            fill="#1a1d27"
            isAnimationActive={false}
          />
          {/* Regression mid line */}
          <Line
            type="monotone"
            dataKey="mid"
            stroke="#3b82f6"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
            isAnimationActive={false}
          />
          {/* Upper / lower bounds */}
          <Line
            type="monotone"
            dataKey="upper"
            stroke="#3b82f666"
            strokeWidth={1}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="lower"
            stroke="#3b82f666"
            strokeWidth={1}
            dot={false}
            isAnimationActive={false}
          />
          {/* Actual price */}
          <Line
            type="monotone"
            dataKey="price"
            stroke="#ffffff"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
