"use client";

import Link from "next/link";
import type { Quote } from "@/types/openbb";

interface Props {
  data: Quote[];
}

export default function CryptoTable({ data }: Props) {
  if (!data.length) return <p className="text-muted text-sm">Dati non disponibili.</p>;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="border-b border-border">
          <tr className="text-muted">
            <th className="text-left p-4">#</th>
            <th className="text-left p-4">Simbolo</th>
            <th className="text-right p-4">Prezzo</th>
            <th className="text-right p-4">Variazione 24h</th>
            {data[0]?.market_cap && <th className="text-right p-4">Market Cap</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.symbol} className="border-b border-border/50 hover:bg-white/5">
              <td className="p-4 text-muted">{i + 1}</td>
              <td className="p-4">
                <Link
                  href={`/equity/${row.symbol}`}
                  className="text-white hover:text-accent font-medium"
                >
                  {row.symbol.replace("-USD", "")}
                </Link>
                {row.name && <span className="text-muted text-xs block">{row.name}</span>}
              </td>
              <td className="p-4 text-right text-white font-semibold">
                ${row.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className={`p-4 text-right font-medium ${row.day_change_percent >= 0 ? "text-positive" : "text-negative"}`}>
                {row.day_change_percent >= 0 ? "+" : ""}
                {row.day_change_percent.toFixed(2)}%
              </td>
              {row.market_cap && (
                <td className="p-4 text-right text-muted">
                  ${(row.market_cap / 1e9).toFixed(1)}B
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
