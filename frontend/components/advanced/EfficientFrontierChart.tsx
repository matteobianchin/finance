"use client";

import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceDot,
} from "recharts";
import type { EfficientFrontierPoint, PortfolioAllocation } from "@/types/openbb";

interface Props {
  frontier: EfficientFrontierPoint[];
  maxSharpe: PortfolioAllocation;
  minVariance: PortfolioAllocation;
  riskParity: PortfolioAllocation;
}

export default function EfficientFrontierChart({ frontier, maxSharpe, minVariance, riskParity }: Props) {
  if (!frontier.length) return null;

  const data = frontier.map((p) => ({
    vol: +(p.vol * 100).toFixed(2),
    ret: +(p.ret * 100).toFixed(2),
  }));

  const fmt = (p: PortfolioAllocation) => ({
    vol: +(p.volatility * 100).toFixed(2),
    ret: +(p.expected_return * 100).toFixed(2),
  });

  const ms = fmt(maxSharpe);
  const mv = fmt(minVariance);
  const rp = fmt(riskParity);

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-2">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <span className="text-muted text-xs uppercase tracking-wide">Frontiera Efficiente</span>
        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />Max Sharpe</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />Min Variance</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />Risk Parity</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ScatterChart margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
          <XAxis
            dataKey="vol"
            name="Volatilità"
            type="number"
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickFormatter={(v) => `${v}%`}
            label={{ value: "Volatilità (%)", position: "insideBottom", offset: -2, fontSize: 10, fill: "#6b7280" }}
          />
          <YAxis
            dataKey="ret"
            name="Rendimento"
            type="number"
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }}
            formatter={(v: number, name: string) => [`${v}%`, name]}
          />
          <Scatter data={data} fill="#3b82f6" opacity={0.7} />
          {/* Max Sharpe star */}
          <ReferenceDot x={ms.vol} y={ms.ret} r={7} fill="#facc15" stroke="none" />
          {/* Min Variance */}
          <ReferenceDot x={mv.vol} y={mv.ret} r={7} fill="#60a5fa" stroke="none" />
          {/* Risk Parity */}
          <ReferenceDot x={rp.vol} y={rp.ret} r={7} fill="#a78bfa" stroke="none" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
