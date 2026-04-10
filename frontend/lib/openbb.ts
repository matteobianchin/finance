import type {
  OBBResponse,
  PriceBar,
  Quote,
  SearchResult,
  IncomeStatement,
  KeyMetrics,
  NewsArticle,
  FredSeries,
  EarningsEvent,
} from "@/types/openbb";

// ---------------------------------------------------------------------------
// Base URL
// ---------------------------------------------------------------------------
// Client-side  → always use the Next.js rewrite proxy (/api/openbb → OpenBB)
//               This avoids CORS and keeps the backend URL out of the browser.
// Server-side  → call OpenBB directly via OPENBB_INTERNAL_URL.
//               Falls back to NEXT_PUBLIC_API_URL (same value in Docker) then
//               localhost:6900 for local dev without Docker.
// ---------------------------------------------------------------------------
function getBase(): string {
  if (typeof window === "undefined") {
    // Server-side (Route Handlers, build-time): direct call to OpenBB backend.
    // OPENBB_INTERNAL_URL is the preferred server-only var (not exposed to browser).
    // Falls back to NEXT_PUBLIC_API_URL (same value in Docker) then localhost for dev.
    const internal =
      process.env.OPENBB_INTERNAL_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      "http://localhost:6900";
    return `${internal}/api/v1`;
  }
  // Client-side: route through the Next.js rewrite proxy (/api/openbb → OpenBB backend).
  // Using window.location.origin makes the URL absolute (required for new URL()).
  return `${window.location.origin}/api/openbb`;
}

// ---------------------------------------------------------------------------
// In-memory cache (module-level → lives for the browser session / Node process)
// ---------------------------------------------------------------------------
const _cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 60_000; // 1 minute

function cacheGet<T>(key: string): T[] | null {
  const entry = _cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data as T[];
  return null;
}

function cacheSet(key: string, data: unknown): void {
  _cache.set(key, { data, ts: Date.now() });
}

// ---------------------------------------------------------------------------
// Core fetch helper
// ---------------------------------------------------------------------------
async function obbFetch<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T[]> {
  const url = new URL(`${getBase()}/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const key = url.toString();

  const cached = cacheGet<T>(key);
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) throw new Error(`OpenBB API error: ${res.status} on ${path}`);
    const data: OBBResponse<T> = await res.json();
    cacheSet(key, data.results);
    return data.results;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Timeframe helpers
// ---------------------------------------------------------------------------
export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

const TIMEFRAME_PARAMS: Record<string, { start_date: string; interval?: string }> = {
  "1D": { start_date: daysAgo(2), interval: "5m" },
  "1W": { start_date: daysAgo(7) },
  "1M": { start_date: daysAgo(30) },
  "3M": { start_date: daysAgo(90) },
  "6M": { start_date: daysAgo(180) },
  "1Y": { start_date: daysAgo(365) },
  "5Y": { start_date: daysAgo(1825) },
};

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

export async function getPriceHistory(
  symbol: string,
  timeframe: string
): Promise<PriceBar[]> {
  const params = TIMEFRAME_PARAMS[timeframe] ?? TIMEFRAME_PARAMS["1M"];
  return obbFetch<PriceBar>("equity/price/historical", {
    symbol,
    provider: "yfinance",
    ...params,
  });
}

export async function getCryptoPriceHistory(
  symbol: string,
  timeframe: string
): Promise<PriceBar[]> {
  const params = TIMEFRAME_PARAMS[timeframe] ?? TIMEFRAME_PARAMS["1M"];
  return obbFetch<PriceBar>("crypto/price/historical", {
    symbol,
    provider: "yfinance",
    ...params,
  });
}

export async function getQuote(symbol: string): Promise<Quote> {
  const results = await obbFetch<Quote>("equity/price/quote", {
    symbol,
    provider: "yfinance",
  });
  if (!results[0]) throw new Error(`No quote for ${symbol}`);
  return results[0];
}

export async function searchEquity(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  return obbFetch<SearchResult>("equity/search", { query, provider: "yfinance" });
}

export async function getIncomeStatement(
  symbol: string
): Promise<IncomeStatement[]> {
  return obbFetch<IncomeStatement>("equity/fundamental/income", {
    symbol,
    provider: "fmp",
    period: "annual",
    limit: "5",
  });
}

export async function getKeyMetrics(symbol: string): Promise<KeyMetrics[]> {
  return obbFetch<KeyMetrics>("equity/fundamental/metrics", {
    symbol,
    provider: "fmp",
    limit: "5",
  });
}

export async function getNews(symbols: string): Promise<NewsArticle[]> {
  return obbFetch<NewsArticle>("equity/news", {
    symbols,
    provider: "tiingo",
    limit: "10",
  });
}

export async function getFredSeries(
  symbol: string,
  startDate?: string
): Promise<FredSeries[]> {
  return obbFetch<FredSeries>("economy/fred_series", {
    symbol,
    provider: "fred",
    ...(startDate
      ? { start_date: startDate }
      : { start_date: daysAgo(365 * 5) }),
  });
}

export async function getCryptoQuote(symbol: string): Promise<Quote> {
  const results = await obbFetch<Quote>("equity/price/quote", {
    symbol,
    provider: "yfinance",
  });
  if (!results[0]) throw new Error(`No quote for ${symbol}`);
  return results[0];
}

export async function getCryptoTop10(): Promise<Quote[]> {
  const symbols = [
    "BTC-USD", "ETH-USD", "BNB-USD", "SOL-USD", "XRP-USD",
    "ADA-USD", "AVAX-USD", "DOGE-USD", "DOT-USD", "MATIC-USD",
  ];
  const results = await Promise.allSettled(symbols.map((s) => getCryptoQuote(s)));
  return results
    .filter((r): r is PromiseFulfilledResult<Quote> => r.status === "fulfilled")
    .map((r) => r.value);
}

export async function getEarningsCalendar(
  symbols: string[]
): Promise<EarningsEvent[]> {
  const results = await Promise.allSettled(
    symbols.map((s) =>
      obbFetch<EarningsEvent>("equity/calendar/earnings", {
        symbol: s,
        provider: "yfinance",
      })
    )
  );
  return results
    .filter(
      (r): r is PromiseFulfilledResult<EarningsEvent[]> =>
        r.status === "fulfilled"
    )
    .flatMap((r) => r.value);
}
