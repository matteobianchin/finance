export interface ScreenerRow {
  ticker: string;
  price: number;
  change1d: number;
  volume?: number;
  marketCap?: number;
  pe?: number;
  return1m?: number;
  rsi?: number;
}

export type SortKey = keyof ScreenerRow;
export type SortDir = "asc" | "desc";

export function filterRows(
  rows: ScreenerRow[],
  filters: {
    minRsi?: number;
    maxRsi?: number;
    minReturn1m?: number;
    maxReturn1m?: number;
    maxPe?: number;
    search?: string;
  }
): ScreenerRow[] {
  return rows.filter((r) => {
    if (filters.minRsi !== undefined && (r.rsi ?? 0) < filters.minRsi) return false;
    if (filters.maxRsi !== undefined && (r.rsi ?? 100) > filters.maxRsi) return false;
    if (filters.minReturn1m !== undefined && (r.return1m ?? -Infinity) < filters.minReturn1m) return false;
    if (filters.maxReturn1m !== undefined && (r.return1m ?? Infinity) > filters.maxReturn1m) return false;
    if (filters.maxPe !== undefined && r.pe !== undefined && r.pe > filters.maxPe) return false;
    if (filters.search && !r.ticker.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });
}

export function sortRows(rows: ScreenerRow[], key: SortKey, dir: SortDir): ScreenerRow[] {
  return [...rows].sort((a, b) => {
    const av = a[key] ?? (dir === "desc" ? -Infinity : Infinity);
    const bv = b[key] ?? (dir === "desc" ? -Infinity : Infinity);
    if (typeof av === "string" && typeof bv === "string") {
      return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return dir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });
}
