"use client";

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from "recharts";

interface Props {
  data: { date: string; value: number }[];
  maxDrawdownValue: number;
  durationDays: number;
}

export default function DrawdownChart({ data, maxDrawdownValue, durationDays }: Props) {
  if (data.length === 0) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-muted text-xs uppercase tracking-wide">Drawdown</span>
        <span className="text-negative text-sm font-semibold">
          Max: {(maxDrawdownValue * 100).toFixed(1)}% ({durationDays}gg)
        </span>
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
          <YAxis
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
          />
          <Tooltip
            contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }}
            formatter={(v: number) => [`${(v * 100).toFixed(2)}%`, "Drawdown"]}
          />
          <ReferenceLine y={0} stroke="#6b7280" />
          <Area type="monotone" dataKey="value" stroke="#ef4444" fill="#ef444420" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
