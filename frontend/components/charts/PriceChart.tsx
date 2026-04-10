"use client";

import { useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { Download } from "lucide-react";
import type { PriceBar, Timeframe } from "@/types/openbb";

const TIMEFRAMES: Timeframe[] = ["1D", "1W", "1M", "3M", "6M", "1Y", "5Y"];

export interface EmaLine {
  period: number;
  values: number[];
  color: string;
  enabled: boolean;
}

interface Props {
  data: PriceBar[];
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  loading?: boolean;
  emaLines?: EmaLine[];
  onToggleEma?: (period: number) => void;
}

export default function PriceChart({
  data,
  timeframe,
  onTimeframeChange,
  loading,
  emaLines = [],
  onToggleEma,
}: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const first = data[0]?.close ?? 0;
  const last = data.at(-1)?.close ?? 0;
  const positive = last >= first;
  const color = positive ? "#22c55e" : "#ef4444";

  const chartData = data.map((d, i) => {
    const point: Record<string, number | string> = {
      date: d.date.slice(0, 10),
      close: d.close,
    };
    for (const ema of emaLines) {
      const v = ema.values[i];
      if (ema.enabled && v !== undefined && !isNaN(v)) {
        point[`ema${ema.period}`] = v;
      }
    }
    return point;
  });

  async function exportPng() {
    const el = chartRef.current;
    if (!el) return;
    const svgEl = el.querySelector("svg");
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    await new Promise<void>((resolve) => {
      img.onload = () => {
        canvas.width = svgEl.clientWidth * 2;
        canvas.height = svgEl.clientHeight * 2;
        ctx.fillStyle = "#0f1117";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve();
      };
      img.src = url;
    });
    const link = document.createElement("a");
    link.download = "chart.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex flex-wrap gap-1 mb-4 items-center">
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

        {/* EMA toggle pills */}
        {emaLines.length > 0 && (
          <div className="ml-auto flex gap-1 items-center">
            {emaLines.map((ema) => (
              <button
                key={ema.period}
                onClick={() => onToggleEma?.(ema.period)}
                style={{
                  borderColor: ema.color,
                  color: ema.enabled ? "#fff" : ema.color,
                  background: ema.enabled ? ema.color + "33" : "transparent",
                }}
                className="px-2 py-0.5 rounded text-xs border transition-colors"
              >
                EMA{ema.period}
              </button>
            ))}
            <button
              onClick={exportPng}
              className="ml-1 text-muted hover:text-white"
              title="Esporta PNG"
            >
              <Download size={13} />
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-muted text-sm">
          Caricamento...
        </div>
      ) : (
        <div ref={chartRef}>
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
                contentStyle={{
                  background: "#1a1d27",
                  border: "1px solid #2a2d3a",
                  borderRadius: 8,
                }}
                labelStyle={{ color: "#e5e7eb" }}
                formatter={(v: number, name: string) => {
                  if (name === "close") return [`$${v.toFixed(2)}`, "Chiusura"];
                  return [`$${v.toFixed(2)}`, name.toUpperCase()];
                }}
              />
              <Line
                type="monotone"
                dataKey="close"
                stroke={color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              {emaLines
                .filter((e) => e.enabled)
                .map((ema) => (
                  <Line
                    key={ema.period}
                    type="monotone"
                    dataKey={`ema${ema.period}`}
                    stroke={ema.color}
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
