"use client";

import { useState } from "react";
import CSVImport from "@/components/portfolio/CSVImport";
import PortfolioTable from "@/components/portfolio/PortfolioTable";
import AllocationPieChart from "@/components/charts/AllocationPieChart";
import { getQuote } from "@/lib/openbb";
import { calcPositions } from "@/lib/portfolio";
import type { PortfolioRow, PortfolioPosition } from "@/types/openbb";

export default function PortfolioPage() {
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImport(rows: PortfolioRow[]) {
    setLoading(true);
    setError(null);
    try {
      const uniqueTickers = [...new Set(rows.map((r) => r.ticker))];
      const quoteResults = await Promise.allSettled(
        uniqueTickers.map((t) => getQuote(t).then((q) => ({ ticker: t, price: q.price })))
      );

      const prices: Record<string, number> = {};
      quoteResults.forEach((r) => {
        if (r.status === "fulfilled") {
          prices[r.value.ticker] = r.value.price;
        }
      });

      const failedTickers = uniqueTickers.filter((t) => !(t in prices));
      if (failedTickers.length > 0) {
        setError(`Impossibile recuperare prezzi per: ${failedTickers.join(", ")}`);
      }

      setPositions(calcPositions(rows, prices));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-white">Portfolio</h1>

      <CSVImport onImport={handleImport} />

      {error && (
        <div className="bg-negative/10 border border-negative/30 rounded-lg p-3 text-negative text-sm">
          {error}
        </div>
      )}

      {loading && <p className="text-muted text-sm">Recupero prezzi attuali...</p>}

      {positions.length > 0 && (
        <>
          <PortfolioTable positions={positions} />
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-white font-medium mb-2">Allocazione</h3>
            <AllocationPieChart positions={positions} />
          </div>
        </>
      )}
    </div>
  );
}
