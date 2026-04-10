"use client";

import { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from "recharts";
import { drawdownSeries, maxDrawdown } from "@/lib/quant";

interface Props {
  closes: number[];
  dates: string[];
}

export default function DrawdownChart({ closes, dates }: Props) {
  const dd = useMemo(() => drawdownSeries(closes), [closes.join(",")]);
  const { value: maxDD, durationDays } = useMemo(
    () => maxDrawdown(closes),
    [closes.join(",")]
  );

  const data = dd.map((v, i) => ({
    date: dates[i]?.slice(0, 10) ?? "",
    dd: parseFloat((v * 100).toFixed(2)),
  }));

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-muted text-xs uppercase tracking-wide mb-3">
        Drawdown (Underwater Chart)
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: "#6b7280" }}
            tickFormatter={(v) => v.slice(5)}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 9, fill: "#6b7280" }}
            tickFormatter={(v) => `${v}%`}
            domain={["auto", 0]}
          />
          <Tooltip
            contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }}
            formatter={(v: number) => [`${v.toFixed(2)}%`, "Drawdown"]}
          />
          <ReferenceLine y={0} stroke="#22c55e" strokeOpacity={0.5} />
          <Area
            type="monotone"
            dataKey="dd"
            stroke="#ef4444"
            strokeWidth={1.5}
            fill="#ef444420"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2">
        <span className="text-muted text-xs">
          Max Drawdown:{" "}
          <strong className="text-negative">{(maxDD * 100).toFixed(1)}%</strong>
        </span>
        <span className="text-muted text-xs">
          Durata: <strong className="text-white">{durationDays} giorni</strong>
        </span>
      </div>
    </div>
  );
}
