"use client";

import { useMemo } from "react";
import { RSI, MACD, BollingerBands } from "technicalindicators";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import IndicatorChart from "@/components/charts/IndicatorChart";
import type { PriceBar } from "@/types/openbb";

interface Props {
  data: PriceBar[];
}

function interpretRsi(value: number): { label: string; color: string } {
  if (value >= 70) return { label: "Ipercomprato", color: "text-negative" };
  if (value <= 30) return { label: "Ipervenduto", color: "text-positive" };
  return { label: "Neutrale", color: "text-muted" };
}

function interpretMacd(hist: number): { label: string; color: string } {
  if (hist > 0) return { label: "Rialzista", color: "text-positive" };
  if (hist < 0) return { label: "Ribassista", color: "text-negative" };
  return { label: "Neutrale", color: "text-muted" };
}

function interpretBB(price: number, upper: number, lower: number): { label: string; color: string } {
  if (price >= upper) return { label: "Sopra banda sup.", color: "text-negative" };
  if (price <= lower) return { label: "Sotto banda inf.", color: "text-positive" };
  return { label: "Dentro le bande", color: "text-muted" };
}

export default function SignalsPanel({ data }: Props) {
  const closes = data.map((d) => d.close);
  const dates = data.map((d) => d.date.slice(0, 10));
  const closesKey = closes.join(",");

  const rsiValues = useMemo(() => {
    if (closes.length < 14) return [];
    return RSI.calculate({ values: closes, period: 14 });
  }, [closesKey]);

  const macdValues = useMemo(() => {
    if (closes.length < 26) return [];
    return MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
  }, [closesKey]);

  const bbValues = useMemo(() => {
    if (closes.length < 20) return [];
    return BollingerBands.calculate({
      values: closes,
      period: 20,
      stdDev: 2,
    });
  }, [closesKey]);

  const rsiData = rsiValues.map((v, i) => ({
    date: dates[dates.length - rsiValues.length + i],
    value: v,
  }));

  const macdHistData = macdValues.map((v, i) => ({
    date: dates[dates.length - macdValues.length + i],
    value: v.histogram ?? 0,
  }));

  const bbChartData = bbValues.map((v, i) => ({
    date: dates[dates.length - bbValues.length + i],
    upper: v.upper,
    middle: v.middle,
    lower: v.lower,
    price: closes[closes.length - bbValues.length + i],
  }));

  const lastRsi = rsiValues.at(-1);
  const lastMacdHist = macdValues.at(-1)?.histogram ?? 0;
  const lastBB = bbValues.at(-1);
  const lastPrice = closes.at(-1) ?? 0;

  const rsiSignal = lastRsi !== undefined ? interpretRsi(lastRsi) : null;
  const macdSignal = interpretMacd(lastMacdHist);
  const bbSignal = lastBB ? interpretBB(lastPrice, lastBB.upper, lastBB.lower) : null;

  return (
    <div className="space-y-4">
      {/* Riepilogo segnali */}
      <div className="bg-card border border-border rounded-xl p-4 grid grid-cols-3 gap-4">
        <div>
          <span className="text-muted text-xs uppercase">RSI (14)</span>
          <p className="text-white font-semibold">{lastRsi?.toFixed(1) ?? "—"}</p>
          {rsiSignal && <p className={`text-sm ${rsiSignal.color}`}>{rsiSignal.label}</p>}
        </div>
        <div>
          <span className="text-muted text-xs uppercase">MACD</span>
          <p className="text-white font-semibold">{lastMacdHist.toFixed(3)}</p>
          <p className={`text-sm ${macdSignal.color}`}>{macdSignal.label}</p>
        </div>
        <div>
          <span className="text-muted text-xs uppercase">Bollinger (20)</span>
          <p className="text-white font-semibold">{lastBB ? `$${lastBB.upper.toFixed(1)}` : "—"}</p>
          {bbSignal && <p className={`text-sm ${bbSignal.color}`}>{bbSignal.label}</p>}
        </div>
      </div>

      {/* RSI */}
      {rsiData.length > 0 && (
        <IndicatorChart
          data={rsiData}
          label="RSI (14)"
          color="#a78bfa"
          referenceLines={[70, 30]}
          domain={[0, 100]}
        />
      )}

      {/* MACD Histogram */}
      {macdHistData.length > 0 && (
        <IndicatorChart
          data={macdHistData}
          label="MACD Histogram"
          color="#3b82f6"
          referenceLines={[0]}
        />
      )}

      {/* Bollinger Bands — grafico multi-linea */}
      {bbChartData.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <span className="text-muted text-xs uppercase tracking-wide">Bollinger Bands (20, 2σ)</span>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={bbChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} tickFormatter={(v) => v.slice(5)} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} domain={["auto", "auto"]} tickFormatter={(v) => `$${v.toFixed(0)}`} />
              <Tooltip
                contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }}
                formatter={(v: number, name: string) => [`$${v.toFixed(2)}`, name]}
              />
              <ReferenceLine y={0} stroke="transparent" />
              <Line type="monotone" dataKey="upper" stroke="#ef4444" strokeWidth={1} dot={false} isAnimationActive={false} name="Upper" />
              <Line type="monotone" dataKey="middle" stroke="#6b7280" strokeWidth={1} strokeDasharray="4 4" dot={false} isAnimationActive={false} name="SMA20" />
              <Line type="monotone" dataKey="lower" stroke="#22c55e" strokeWidth={1} dot={false} isAnimationActive={false} name="Lower" />
              <Line type="monotone" dataKey="price" stroke="#ffffff" strokeWidth={1.5} dot={false} isAnimationActive={false} name="Prezzo" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
