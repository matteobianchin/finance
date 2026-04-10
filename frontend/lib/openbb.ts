import type {
  OBBResponse,
  PriceBar,
  Quote,
  SearchResult,
  IncomeStatement,
  KeyMetrics,
  NewsArticle,
  FredSeries,
} from "@/types/openbb";

function getBase(): string {
  return process.env.NEXT_PUBLIC_API_URL
    ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1`
    : "/api/openbb";
}

// Timeframe -> parametri start_date + interval
const TIMEFRAME_PARAMS: Record<string, { start_date: string; interval?: string }> = {
  "1D": { start_date: daysAgo(2), interval: "5m" },
  "1W": { start_date: daysAgo(7) },
  "1M": { start_date: daysAgo(30) },
  "3M": { start_date: daysAgo(90) },
  "6M": { start_date: daysAgo(180) },
  "1Y": { start_date: daysAgo(365) },
  "5Y": { start_date: daysAgo(1825) },
};

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

async function obbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T[]> {
  const url = new URL(`${getBase()}/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) throw new Error(`OpenBB API error: ${res.status} on ${path}`);
    const data: OBBResponse<T> = await res.json();
    return data.results;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getPriceHistory(symbol: string, timeframe: string): Promise<PriceBar[]> {
  const params = TIMEFRAME_PARAMS[timeframe] ?? TIMEFRAME_PARAMS["1M"];
  return obbFetch<PriceBar>("equity/price/historical", {
    symbol,
    provider: "yfinance",
    ...params,
  });
}

export async function getCryptoPriceHistory(symbol: string, timeframe: string): Promise<PriceBar[]> {
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

export async function getIncomeStatement(symbol: string): Promise<IncomeStatement[]> {
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
    ...(startDate ? { start_date: startDate } : { start_date: daysAgo(365 * 5) }),
  });
}

export async function getCryptoTop10(): Promise<Quote[]> {
  const symbols = ["BTC-USD", "ETH-USD", "BNB-USD", "SOL-USD", "XRP-USD",
                   "ADA-USD", "AVAX-USD", "DOGE-USD", "DOT-USD", "MATIC-USD"];
  const results = await Promise.allSettled(symbols.map((s) => getQuote(s)));
  return results
    .filter((r): r is PromiseFulfilledResult<Quote> => r.status === "fulfilled")
    .map((r) => r.value);
}
