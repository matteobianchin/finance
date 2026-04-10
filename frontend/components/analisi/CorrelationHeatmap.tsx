"use client";

import { useMemo } from "react";
import { correlationMatrix } from "@/lib/quant";

interface TickerSeries {
  ticker: string;
  closes: number[];
}

interface Props {
  series: TickerSeries[];
}

function corrColor(value: number): string {
  if (value >= 0) return `rgba(59, 130, 246, ${value.toFixed(2)})`;
  return `rgba(239, 68, 68, ${Math.abs(value).toFixed(2)})`;
}

export default function CorrelationHeatmap({ series }: Props) {
  const tickers = series.map((s) => s.ticker);

  const matrix = useMemo(() => {
    const returns = series.map((s) => {
      const r: number[] = [];
      for (let i = 1; i < s.closes.length; i++) {
        r.push((s.closes[i] - s.closes[i - 1]) / s.closes[i - 1]);
      }
      return r;
    });
    const minLen = Math.min(...returns.map((r) => r.length));
    return correlationMatrix(returns.map((r) => r.slice(r.length - minLen)));
  }, [series.map((s) => s.ticker + s.closes.length).join(",")]);

  if (series.length < 2) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-muted text-xs uppercase tracking-wide mb-3">
          Correlazione Watchlist
        </p>
        <p className="text-muted text-sm">
          Aggiungi almeno 2 ticker alla watchlist per la matrice di correlazione.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-muted text-xs uppercase tracking-wide mb-3">
        Correlazione Watchlist
      </p>
      <div className="overflow-x-auto">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `56px repeat(${tickers.length}, 1fr)`,
            gap: 2,
            fontSize: 11,
          }}
        >
          <div />
          {tickers.map((t) => (
            <div key={t} className="text-muted text-center py-1 font-medium truncate">
              {t}
            </div>
          ))}
          {tickers.map((rowTicker, i) => (
            <>
              <div key={rowTicker} className="text-muted py-1 font-medium truncate">
                {rowTicker}
              </div>
              {tickers.map((_, j) => {
                const val = matrix[i]?.[j] ?? 0;
                return (
                  <div
                    key={j}
                    style={{
                      background: corrColor(val),
                      borderRadius: 3,
                      padding: "5px 4px",
                      textAlign: "center",
                      color: "#fff",
                      fontWeight: 600,
                    }}
                  >
                    {val.toFixed(2)}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  );
}
