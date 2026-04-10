"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { PortfolioPosition } from "@/types/openbb";

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a78bfa", "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#14b8a6"];

interface Props {
  positions: PortfolioPosition[];
}

export default function AllocationPieChart({ positions }: Props) {
  const data = positions.map((p) => ({
    name: p.ticker,
    value: p.current_value,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={100}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }}
          formatter={(v: number) => [`$${v.toFixed(2)}`, "Valore"]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
