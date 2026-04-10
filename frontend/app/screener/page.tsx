"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getPriceHistory, getQuote } from "@/lib/openbb";
import { RSI } from "technicalindicators";
import { filterRows, sortRows } from "@/lib/screener";
import { useWatchlist } from "@/components/providers/WatchlistProvider";
import type { ScreenerRow, SortKey, SortDir } from "@/lib/screener";

const BASE_UNIVERSE = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK-B", "JPM", "JNJ",
  "V", "PG", "UNH", "HD", "MA", "XOM", "LLY", "ABBV", "MRK", "PEP",
];

export default function ScreenerPage() {
  const router = useRouter();
  const { tickers: watchlist } = useWatchlist();
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("change1d");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [minRsi, setMinRsi] = useState("");
  const [maxRsi, setMaxRsi] = useState("");
  const [minRet, setMinRet] = useState("");
  const [maxRet, setMaxRet] = useState("");

  const universe = useMemo(
    () => Array.from(new Set([...BASE_UNIVERSE, ...watchlist])),
    [watchlist.join(",")]
  );

  useEffect(() => {
    setLoading(true);
    Promise.allSettled(
      universe.map(async (ticker) => {
        const [quote, hist1m] = await Promise.all([
          getQuote(ticker).catch(() => null),
          getPriceHistory(ticker, "1M").catch(() => []),
        ]);
        if (!quote) return null;

        const closes = hist1m.map((b) => b.close);
        const rsiVals = closes.length >= 14 ? RSI.calculate({ values: closes, period: 14 }) : [];
        const rsi = rsiVals.at(-1);
        const return1m =
          closes.length >= 2
            ? ((closes.at(-1)! - closes[0]) / closes[0]) * 100
            : undefined;

        return {
          ticker,
          price: quote.price,
          change1d: quote.day_change_percent,
          volume: quote.volume ?? 0,
          marketCap: quote.market_cap,
          pe: quote.pe_ratio,
          return1m,
          rsi,
        } as ScreenerRow;
      })
    ).then((results) => {
      setRows(
        results
          .filter((r) => r.status === "fulfilled" && r.value !== null)
          .map((r) => (r as PromiseFulfilledResult<ScreenerRow>).value)
      );
    }).finally(() => setLoading(false));
  }, [universe.join(",")]);

  const filtered = useMemo(() => {
    const f = filterRows(rows, {
      search,
      minRsi: minRsi ? parseFloat(minRsi) : undefined,
      maxRsi: maxRsi ? parseFloat(maxRsi) : undefined,
      minReturn1m: minRet ? parseFloat(minRet) : undefined,
      maxReturn1m: maxRet ? parseFloat(maxRet) : undefined,
    });
    return sortRows(f, sortKey, sortDir);
  }, [rows, search, minRsi, maxRsi, minRet, maxRet, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const th =
    "text-muted text-xs uppercase px-3 py-2 text-right cursor-pointer hover:text-white select-none";
  const td = "px-3 py-2 text-sm text-right";

  return (
    <div className="space-y-4 max-w-5xl">
      <h1 className="text-2xl font-bold text-white">Screener</h1>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-muted text-xs block mb-1">Ticker</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca…"
            className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-white w-28 outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-muted text-xs block mb-1">RSI min</label>
          <input
            type="number"
            value={minRsi}
            onChange={(e) => setMinRsi(e.target.value)}
            placeholder="0"
            className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-white w-20 outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-muted text-xs block mb-1">RSI max</label>
          <input
            type="number"
            value={maxRsi}
            onChange={(e) => setMaxRsi(e.target.value)}
            placeholder="100"
            className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-white w-20 outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-muted text-xs block mb-1">Rend. 1M min%</label>
          <input
            type="number"
            value={minRet}
            onChange={(e) => setMinRet(e.target.value)}
            placeholder="-∞"
            className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-white w-24 outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-muted text-xs block mb-1">Rend. 1M max%</label>
          <input
            type="number"
            value={maxRet}
            onChange={(e) => setMaxRet(e.target.value)}
            placeholder="+∞"
            className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-white w-24 outline-none focus:border-accent"
          />
        </div>
        <button
          onClick={() => {
            setSearch("");
            setMinRsi("");
            setMaxRsi("");
            setMinRet("");
            setMaxRet("");
          }}
          className="text-muted text-xs hover:text-white mt-4"
        >
          Reset filtri
        </button>
      </div>

      {loading ? (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-muted text-sm">Caricamento {universe.length} ticker...</p>
          <div className="mt-2 h-2 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full animate-pulse w-1/2" />
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th
                  className={`${th} text-left`}
                  onClick={() => toggleSort("ticker")}
                >
                  Ticker {sortKey === "ticker" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                </th>
                <th className={th} onClick={() => toggleSort("price")}>
                  Prezzo {sortKey === "price" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                </th>
                <th className={th} onClick={() => toggleSort("change1d")}>
                  1D% {sortKey === "change1d" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                </th>
                <th className={th} onClick={() => toggleSort("return1m")}>
                  1M% {sortKey === "return1m" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                </th>
                <th className={th} onClick={() => toggleSort("rsi")}>
                  RSI {sortKey === "rsi" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                </th>
                <th className={th} onClick={() => toggleSort("volume")}>
                  Volume {sortKey === "volume" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                </th>
                <th className={th} onClick={() => toggleSort("pe")}>
                  P/E {sortKey === "pe" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.ticker}
                  className="border-b border-border/50 hover:bg-white/5 cursor-pointer transition-colors"
                  onClick={() => router.push(`/equity/${row.ticker}`)}
                >
                  <td className="px-3 py-2 text-sm font-semibold text-white">{row.ticker}</td>
                  <td className={td}>${row.price.toFixed(2)}</td>
                  <td className={`${td} ${row.change1d >= 0 ? "text-positive" : "text-negative"}`}>
                    {row.change1d >= 0 ? "+" : ""}
                    {row.change1d.toFixed(2)}%
                  </td>
                  <td
                    className={`${td} ${(row.return1m ?? 0) >= 0 ? "text-positive" : "text-negative"}`}
                  >
                    {row.return1m !== undefined
                      ? `${row.return1m >= 0 ? "+" : ""}${row.return1m.toFixed(1)}%`
                      : "—"}
                  </td>
                  <td
                    className={`${td} ${
                      row.rsi !== undefined
                        ? row.rsi >= 70
                          ? "text-negative"
                          : row.rsi <= 30
                          ? "text-positive"
                          : "text-white"
                        : "text-muted"
                    }`}
                  >
                    {row.rsi?.toFixed(1) ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-sm text-muted text-right">
                    {row.volume ? (row.volume / 1_000_000).toFixed(1) + "M" : "—"}
                  </td>
                  <td className={td}>{row.pe?.toFixed(1) ?? "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted text-sm">
                    Nessun risultato con i filtri correnti.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
