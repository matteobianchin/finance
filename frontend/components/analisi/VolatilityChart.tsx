"use client";

import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from "recharts";
import { rollingVolatility } from "@/lib/quant";

interface Props {
  closes: number[];
  dates: string[];
}

export default function VolatilityChart({ closes, dates }: Props) {
  const window = 30;
  const volData = useMemo(() => {
    const vols = rollingVolatility(closes, window);
    return vols.map((v, i) => ({
      date: dates[window + i]?.slice(0, 10) ?? "",
      vol: parseFloat((v * 100).toFixed(2)),
    }));
  }, [closes.join(",")]);

  const avg =
    volData.length ? volData.reduce((s, d) => s + d.vol, 0) / volData.length : 0;
  const current = volData.at(-1)?.vol ?? 0;
  const maxVol = volData.reduce((m, d) => Math.max(m, d.vol), 0);

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-muted text-xs uppercase tracking-wide mb-3">
        Volatilità Rolling 30d (annualizzata)
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={volData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
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
          />
          <Tooltip
            contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }}
            formatter={(v: number) => [`${v.toFixed(1)}%`, "Volatilità"]}
          />
          <ReferenceLine
            y={avg}
            stroke="#6b7280"
            strokeDasharray="4 4"
            label={{ value: "avg", fill: "#6b7280", fontSize: 9 }}
          />
          <Line
            type="monotone"
            dataKey="vol"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2">
        <span className="text-muted text-xs">
          Attuale: <strong className="text-amber-400">{current.toFixed(1)}%</strong>
        </span>
        <span className="text-muted text-xs">
          Media: <strong className="text-white">{avg.toFixed(1)}%</strong>
        </span>
        <span className="text-muted text-xs">
          Max: <strong className="text-negative">{maxVol.toFixed(1)}%</strong>
        </span>
      </div>
    </div>
  );
}
