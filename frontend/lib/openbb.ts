import type {
  PriceBar, Quote, SearchResult, IncomeStatement, KeyMetrics,
  NewsArticle, FredSeries, EarningsEvent, FundamentalsResult,
  SignalsResult, QuantResult, AdvancedResult, PortfolioOptimizeResult,
} from "@/types/openbb";

// ── Base URL ─────────────────────────────────────────────────────────────────
// Server-side (Route Handlers): calls Domain API directly.
// Browser: routes through Next.js proxy rewrite /api/domain/* → :6901.
// ─────────────────────────────────────────────────────────────────────────────
function getBase(): string {
  if (typeof window === "undefined") {
    return process.env.DOMAIN_API_URL ?? "http://localhost:6901";
  }
  return `${window.location.origin}/api/domain`;
}

// ── In-memory cache (TTL 60s) ─────────────────────────────────────────────────
const _cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 60_000;

function cacheGet<T>(key: string): T | null {
  const entry = _cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data as T;
  return null;
}

function cacheSet(key: string, data: unknown): void {
  _cache.set(key, { data, ts: Date.now() });
}

// ── Core fetch helper ─────────────────────────────────────────────────────────
async function domainFetch<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${getBase()}/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const key = url.toString();

  const cached = cacheGet<T>(key);
  if (cached !== null) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) throw new Error(`Domain API error: ${res.status} on ${path}`);
    const data = await res.json();
    cacheSet(key, data);
    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Timeframe helper (kept for any client-side usage) ─────────────────────────
export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

// ── Data endpoints ────────────────────────────────────────────────────────────

export async function getQuote(symbol: string): Promise<Quote> {
  return domainFetch<Quote>(`quote/${symbol}`);
}

export async function getPriceHistory(
  symbol: string,
  timeframe: string
): Promise<PriceBar[]> {
  return domainFetch<PriceBar[]>(`history/${symbol}`, { timeframe });
}

export async function getCryptoPriceHistory(
  symbol: string,
  timeframe: string
): Promise<PriceBar[]> {
  return domainFetch<PriceBar[]>(`history/${symbol}`, { timeframe });
}

export async function searchEquity(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  return domainFetch<SearchResult[]>("search", { query });
}

export async function getFundamentals(symbol: string): Promise<FundamentalsResult> {
  return domainFetch<FundamentalsResult>(`fundamentals/${symbol}`);
}

/** @deprecated Use getFundamentals() instead */
export async function getIncomeStatement(symbol: string): Promise<IncomeStatement[]> {
  const result = await getFundamentals(symbol);
  return result.income;
}

/** @deprecated Use getFundamentals() instead */
export async function getKeyMetrics(symbol: string): Promise<KeyMetrics[]> {
  const result = await getFundamentals(symbol);
  return result.metrics;
}

export async function getNews(symbols: string): Promise<NewsArticle[]> {
  return domainFetch<NewsArticle[]>(`news/${symbols}`);
}

export async function getFredSeries(
  symbol: string,
  startDate?: string
): Promise<FredSeries[]> {
  const params: Record<string, string> = {};
  if (startDate) params.start_date = startDate;
  return domainFetch<FredSeries[]>(`macro/${symbol}`, params);
}

export async function getEarningsCalendar(
  symbols: string[]
): Promise<EarningsEvent[]> {
  return domainFetch<EarningsEvent[]>("earnings", {
    symbols: symbols.join(","),
  });
}

export async function getCryptoTop10(): Promise<Quote[]> {
  return domainFetch<Quote[]>("crypto/top");
}

// ── Semantic endpoints ────────────────────────────────────────────────────────

export async function getSignals(
  ticker: string,
  timeframe: string
): Promise<SignalsResult> {
  return domainFetch<SignalsResult>(`signals/${ticker}`, { timeframe });
}

export async function getQuant(
  ticker: string,
  timeframe: string = "1Y",
  benchmark: string = "SPY"
): Promise<QuantResult> {
  return domainFetch<QuantResult>(`quant/${ticker}`, { timeframe, benchmark });
}

export async function getAdvanced(
  ticker: string,
  timeframe: string = "1Y"
): Promise<AdvancedResult> {
  return domainFetch<AdvancedResult>(`advanced/${ticker}`, { timeframe });
}

export async function getHealth(): Promise<{
  status: string;
  providers: { fmp: boolean; tiingo: boolean; fred: boolean };
}> {
  return domainFetch("health");
}

export async function getPortfolioOptimize(
  symbols: string[],
  timeframe: string = "1Y"
): Promise<PortfolioOptimizeResult> {
  return domainFetch<PortfolioOptimizeResult>("portfolio/optimize", {
    symbols: symbols.join(","),
    timeframe,
  });
}

export async function getScreenerData(
  symbols: string[]
): Promise<
  {
    ticker: string;
    price: number;
    change1d: number;
    volume?: number;
    marketCap?: number;
    pe?: number;
    return1m?: number;
    rsi?: number;
  }[]
> {
  return domainFetch(`screener`, { symbols: symbols.join(",") });
}
