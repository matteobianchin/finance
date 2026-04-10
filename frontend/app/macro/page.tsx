"use client";

import { useEffect, useState } from "react";
import MacroSeriesChart from "@/components/macro/MacroSeriesChart";
import { getFredSeries } from "@/lib/openbb";
import type { FredSeries } from "@/types/openbb";

const SERIES = [
  { symbol: "FEDFUNDS", label: "Tasso FED", unit: "%", color: "#ef4444" },
  { symbol: "CPIAUCSL", label: "Inflazione CPI", unit: "%", color: "#f59e0b" },
  { symbol: "GDP",      label: "PIL USA (mld $)", unit: "B", color: "#22c55e" },
  { symbol: "DGS10",   label: "Treasury 10Y", unit: "%", color: "#3b82f6" },
  { symbol: "DGS2",    label: "Treasury 2Y", unit: "%", color: "#a78bfa" },
];

export default function MacroPage() {
  const [seriesData, setSeriesData] = useState<Record<string, FredSeries[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled(
      SERIES.map(({ symbol }) =>
        getFredSeries(symbol).then((data) => ({ symbol, data }))
      )
    ).then((results) => {
      const map: Record<string, FredSeries[]> = {};
      results.forEach((r) => {
        if (r.status === "fulfilled") {
          map[r.value.symbol] = r.value.data;
        }
      });
      setSeriesData(map);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="text-2xl font-bold text-white">Macro</h1>
      {loading ? (
        <p className="text-muted text-sm">Caricamento serie FRED...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SERIES.map(({ symbol, label, unit, color }) => (
            <MacroSeriesChart
              key={symbol}
              data={seriesData[symbol] ?? []}
              label={label}
              unit={unit}
              color={color}
            />
          ))}
        </div>
      )}
    </div>
  );
}
