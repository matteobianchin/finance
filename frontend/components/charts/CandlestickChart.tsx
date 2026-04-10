"use client";

import { useState, useRef, useEffect } from "react";
import type { PriceBar, Timeframe } from "@/types/openbb";

const TIMEFRAMES: Timeframe[] = ["1D", "1W", "1M", "3M", "6M", "1Y", "5Y"];
const PADDING = { top: 10, right: 58, bottom: 28, left: 4 };
const VOLUME_RATIO = 0.2;

interface Props {
  data: PriceBar[];
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  loading?: boolean;
}

export default function CandlestickChart({
  data,
  timeframe,
  onTimeframeChange,
  loading,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const totalHeight = 300;
  const priceAreaH = totalHeight * (1 - VOLUME_RATIO);
  const volAreaH = totalHeight * VOLUME_RATIO;

  const chartW = width - PADDING.left - PADDING.right;
  const priceH = priceAreaH - PADDING.top - 4;
  const volH = volAreaH - 4;

  // Cap display at 150 candles for readability
  const candles = data.slice(-Math.min(data.length, 150));
  const n = candles.length;

  if (loading || n === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex gap-1 mb-4">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                tf === timeframe ? "bg-accent text-white" : "text-muted hover:text-white"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
        <div className="h-64 bg-border rounded animate-pulse" />
      </div>
    );
  }

  // Price scale
  const allPrices = candles.flatMap((d) => [d.high, d.low]);
  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const priceRange = maxP - minP || 1;

  function yPrice(price: number): number {
    return PADDING.top + ((maxP - price) / priceRange) * priceH;
  }

  // Volume scale
  const maxVol = Math.max(...candles.map((d) => d.volume ?? 0), 1);

  function yVol(vol: number): number {
    return priceAreaH + volH - (vol / maxVol) * volH;
  }

  // X scale
  const slot = chartW / n;
  const candleW = Math.max(1, slot - 1);

  function xCenter(i: number): number {
    return PADDING.left + (i + 0.5) * slot;
  }

  // Y-axis ticks (5 evenly spaced)
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const price = minP + (priceRange * i) / 4;
    return { price, y: yPrice(price) };
  });

  // X-axis ticks (~6)
  const step = Math.max(1, Math.floor(n / 6));
  const xTicks: { label: string; x: number }[] = [];
  for (let i = 0; i < n; i += step) {
    xTicks.push({ label: candles[i].date.slice(5, 10), x: xCenter(i) });
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex gap-1 mb-4 flex-wrap">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => onTimeframeChange(tf)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              tf === timeframe ? "bg-accent text-white" : "text-muted hover:text-white"
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      <div ref={containerRef} className="w-full">
        <svg width="100%" height={totalHeight} viewBox={`0 0 ${width} ${totalHeight}`}>
          {/* Horizontal grid */}
          {yTicks.map(({ y }, i) => (
            <line
              key={i}
              x1={PADDING.left}
              y1={y}
              x2={width - PADDING.right}
              y2={y}
              stroke="#2a2d3a"
              strokeWidth={1}
            />
          ))}

          {/* Y-axis labels */}
          {yTicks.map(({ price, y }, i) => (
            <text
              key={i}
              x={width - PADDING.right + 4}
              y={y + 3}
              fill="#6b7280"
              fontSize={9}
              textAnchor="start"
            >
              ${price.toFixed(1)}
            </text>
          ))}

          {/* X-axis labels */}
          {xTicks.map(({ label, x }, i) => (
            <text
              key={i}
              x={x}
              y={totalHeight - 4}
              fill="#6b7280"
              fontSize={9}
              textAnchor="middle"
            >
              {label}
            </text>
          ))}

          {/* Candles */}
          {candles.map((bar, i) => {
            const isGreen = bar.close >= bar.open;
            const color = isGreen ? "#22c55e" : "#ef4444";
            const bodyTop = yPrice(Math.max(bar.open, bar.close));
            const bodyBot = yPrice(Math.min(bar.open, bar.close));
            const bodyH = Math.max(1, bodyBot - bodyTop);
            const cx = xCenter(i);

            return (
              <g key={bar.date}>
                <line
                  x1={cx}
                  y1={yPrice(bar.high)}
                  x2={cx}
                  y2={yPrice(bar.low)}
                  stroke={color}
                  strokeWidth={1}
                />
                <rect
                  x={cx - candleW / 2}
                  y={bodyTop}
                  width={candleW}
                  height={bodyH}
                  fill={color}
                  fillOpacity={isGreen ? 0.75 : 1}
                  stroke={color}
                  strokeWidth={0.5}
                />
              </g>
            );
          })}

          {/* Volume separator */}
          <line
            x1={PADDING.left}
            y1={priceAreaH}
            x2={width - PADDING.right}
            y2={priceAreaH}
            stroke="#2a2d3a"
            strokeWidth={1}
          />

          {/* Volume bars */}
          {candles.map((bar, i) => {
            const isGreen = bar.close >= bar.open;
            const color = isGreen ? "#22c55e" : "#ef4444";
            const vol = bar.volume ?? 0;
            const barH = Math.max(1, yVol(0) - yVol(vol));
            return (
              <rect
                key={bar.date + "v"}
                x={xCenter(i) - candleW / 2}
                y={priceAreaH + volH - barH}
                width={candleW}
                height={barH}
                fill={color}
                fillOpacity={0.45}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}
