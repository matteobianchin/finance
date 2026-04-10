"use client";

import { useState, useEffect } from "react";
import { getEarningsCalendar } from "@/lib/openbb";
import { useWatchlist } from "@/components/overview/WatchlistManager";
import type { EarningsEvent } from "@/lib/openbb";

export default function EarningsPage() {
  const { tickers } = useWatchlist();
  const [events, setEvents] = useState<EarningsEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (tickers.length === 0) return;
    setLoading(true);
    setError("");
    getEarningsCalendar(tickers)
      .then((data) => {
        const sorted = data.sort((a, b) => a.date.localeCompare(b.date));
        setEvents(sorted);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tickers.join(",")]);

  const today = new Date().toISOString().split("T")[0];
  const upcoming = events.filter((e) => e.date >= today);
  const past = events.filter((e) => e.date < today).reverse();

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-bold text-white">Earnings Calendar</h1>
      <p className="text-muted text-sm">Watchlist corrente: {tickers.join(", ") || "—"}</p>

      {loading && <p className="text-muted text-sm">Caricamento...</p>}
      {error && <p className="text-negative text-sm">{error}</p>}

      {!loading && upcoming.length > 0 && (
        <section>
          <h2 className="text-white font-semibold mb-2">Prossimi earnings</h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-muted text-xs uppercase px-4 py-2 text-left">Ticker</th>
                  <th className="text-muted text-xs uppercase px-4 py-2 text-left">Data</th>
                  <th className="text-muted text-xs uppercase px-4 py-2 text-right">EPS stima</th>
                  <th className="text-muted text-xs uppercase px-4 py-2 text-right">Rev. stima</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((ev, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-white/5">
                    <td className="px-4 py-2 text-sm font-semibold text-white">{ev.symbol}</td>
                    <td className="px-4 py-2 text-sm text-white">{ev.date}</td>
                    <td className="px-4 py-2 text-sm text-right text-muted">
                      {ev.eps_estimate?.toFixed(2) ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-muted">
                      {ev.revenue_estimate ? `$${(ev.revenue_estimate / 1e9).toFixed(2)}B` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!loading && past.length > 0 && (
        <section>
          <h2 className="text-white font-semibold mb-2">Recenti (con risultati)</h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-muted text-xs uppercase px-4 py-2 text-left">Ticker</th>
                  <th className="text-muted text-xs uppercase px-4 py-2 text-left">Data</th>
                  <th className="text-muted text-xs uppercase px-4 py-2 text-right">EPS stima</th>
                  <th className="text-muted text-xs uppercase px-4 py-2 text-right">EPS effettivo</th>
                  <th className="text-muted text-xs uppercase px-4 py-2 text-right">Beat?</th>
                </tr>
              </thead>
              <tbody>
                {past.slice(0, 20).map((ev, i) => {
                  const beat =
                    ev.eps_actual !== undefined && ev.eps_estimate !== undefined
                      ? ev.eps_actual > ev.eps_estimate
                      : null;
                  return (
                    <tr key={i} className="border-b border-border/50 hover:bg-white/5">
                      <td className="px-4 py-2 text-sm font-semibold text-white">{ev.symbol}</td>
                      <td className="px-4 py-2 text-sm text-muted">{ev.date}</td>
                      <td className="px-4 py-2 text-sm text-right text-muted">
                        {ev.eps_estimate?.toFixed(2) ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-white">
                        {ev.eps_actual?.toFixed(2) ?? "—"}
                      </td>
                      <td
                        className={`px-4 py-2 text-sm text-right font-medium ${
                          beat === true
                            ? "text-positive"
                            : beat === false
                            ? "text-negative"
                            : "text-muted"
                        }`}
                      >
                        {beat === null ? "—" : beat ? "✓ Beat" : "✗ Miss"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!loading && events.length === 0 && tickers.length > 0 && (
        <p className="text-muted text-sm">
          Nessun dato earnings disponibile per i ticker in watchlist.
        </p>
      )}

      {tickers.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted">
          Aggiungi ticker alla watchlist per vedere il calendario earnings.
        </div>
      )}
    </div>
  );
}
