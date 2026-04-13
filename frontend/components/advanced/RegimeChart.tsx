"use client";

import { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { RegimePoint } from "@/types/openbb";

const REGIME_COLOR: Record<string, string> = {
  Bull:     "#22c55e",
  Bear:     "#ef4444",
  "High-Vol": "#f59e0b",
  Neutral:  "#6b7280",
};

interface Props {
  series: RegimePoint[];
}

export default function RegimeChart({ series }: Props) {
  if (!series.length) return null;

  const data = series.map((r) => ({
    date: r.date,
    regime: r.regime,
    rolling_return: +(r.rolling_return * 100).toFixed(2),
    rolling_vol: +(r.rolling_vol * 100).toFixed(2),
    color: REGIME_COLOR[r.regime] ?? "#6b7280",
  }));

  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of series) counts[r.regime] = (counts[r.regime] ?? 0) + 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ name: k, pct: ((v / series.length) * 100).toFixed(1), color: REGIME_COLOR[k] }));
  }, [series]);

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <span className="text-muted text-xs uppercase tracking-wide">Regime Detection</span>
        <div className="flex gap-3 flex-wrap">
          {summary.map((s) => (
            <span key={s.name} className="text-xs flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: s.color }} />
              <span style={{ color: s.color }}>{s.name}</span>
              <span className="text-muted">{s.pct}%</span>
            </span>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickFormatter={(v) => v.slice(5)}
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} tickFormatter={(v) => `${v}%`} />
          <Tooltip
            contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }}
            formatter={(v: number, name: string) => [`${v}%`, name === "rolling_return" ? "Return Ann." : "Vol Ann."]}
            labelFormatter={(l) => l}
          />
          <Area
            type="monotone"
            dataKey="rolling_return"
            stroke="#a78bfa"
            fill="#a78bfa22"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
