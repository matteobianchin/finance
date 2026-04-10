"use client";

import { useMemo } from "react";
import {
  RSI, MACD, BollingerBands,
} from "technicalindicators";
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

export default function SignalsPanel({ data }: Props) {
  const closes = data.map((d) => d.close);
  const dates = data.map((d) => d.date.slice(0, 10));

  const rsiValues = useMemo(() => {
    if (closes.length < 14) return [];
    return RSI.calculate({ values: closes, period: 14 });
  }, [closes.join(",")]);

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
  }, [closes.join(",")]);

  const rsiData = rsiValues.map((v, i) => ({
    date: dates[dates.length - rsiValues.length + i],
    value: v,
  }));

  const macdHistData = macdValues.map((v, i) => ({
    date: dates[dates.length - macdValues.length + i],
    value: v.histogram ?? 0,
  }));

  const lastRsi = rsiValues.at(-1);
  const lastMacdHist = macdValues.at(-1)?.histogram ?? 0;
  const rsiSignal = lastRsi !== undefined ? interpretRsi(lastRsi) : null;
  const macdSignal = interpretMacd(lastMacdHist);

  return (
    <div className="space-y-4">
      {/* Riepilogo segnali */}
      <div className="bg-card border border-border rounded-xl p-4 grid grid-cols-2 gap-4">
        <div>
          <span className="text-muted text-xs uppercase">RSI (14)</span>
          <p className="text-white font-semibold">{lastRsi?.toFixed(1) ?? "—"}</p>
          {rsiSignal && (
            <p className={`text-sm ${rsiSignal.color}`}>{rsiSignal.label}</p>
          )}
        </div>
        <div>
          <span className="text-muted text-xs uppercase">MACD</span>
          <p className="text-white font-semibold">{lastMacdHist.toFixed(3)}</p>
          <p className={`text-sm ${macdSignal.color}`}>{macdSignal.label}</p>
        </div>
      </div>

      {/* Grafici indicatori */}
      {rsiData.length > 0 && (
        <IndicatorChart
          data={rsiData}
          label="RSI (14)"
          color="#a78bfa"
          referenceLines={[70, 30]}
          domain={[0, 100]}
        />
      )}

      {macdHistData.length > 0 && (
        <IndicatorChart
          data={macdHistData}
          label="MACD Histogram"
          color="#3b82f6"
          referenceLines={[0]}
        />
      )}
    </div>
  );
}
