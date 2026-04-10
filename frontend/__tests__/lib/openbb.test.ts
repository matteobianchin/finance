import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPriceHistory,
  getQuote,
  searchEquity,
  getIncomeStatement,
  getNews,
  getFredSeries,
  getCryptoTop10,
} from "@/lib/openbb";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockOBBResponse<T>(results: T[]) {
  return {
    ok: true,
    json: async () => ({ results, provider: "yfinance", warnings: null, metadata: null }),
  };
}

beforeEach(() => {
  mockFetch.mockReset();
  // In jsdom, window.location.origin is "http://localhost:3000"
  // getBase() client-side returns window.location.origin + "/api/openbb"
  // Tests only check that fetch is called with a URL containing the path segment
});

describe("getPriceHistory", () => {
  it("returns price bars for a valid ticker", async () => {
    const bars = [{ date: "2024-01-02", open: 185, high: 187, low: 184, close: 186, volume: 1000000 }];
    mockFetch.mockResolvedValueOnce(mockOBBResponse(bars));

    const result = await getPriceHistory("AAPL", "1M");
    expect(result).toHaveLength(1);
    expect(result[0].close).toBe(186);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("equity/price/historical"),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("uses correct start_date for 3M timeframe", async () => {
    mockFetch.mockResolvedValueOnce(mockOBBResponse([]));
    await getPriceHistory("AAPL", "3M");
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    // 3M = 90 giorni fa — verifica che start_date sia nell'URL
    expect(calledUrl).toContain("start_date=");
  });

  it("throws ApiError on HTTP failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    await expect(getPriceHistory("INVALID", "1M")).rejects.toThrow("OpenBB API error");
  });
});

describe("getQuote", () => {
  it("returns current quote", async () => {
    const quote = [{ symbol: "AAPL", price: 185.5, day_change: 1.2, day_change_percent: 0.65 }];
    mockFetch.mockResolvedValueOnce(mockOBBResponse(quote));

    const result = await getQuote("AAPL");
    expect(result.price).toBe(185.5);
    expect(result.day_change_percent).toBe(0.65);
  });

  it("throws when no results returned", async () => {
    mockFetch.mockResolvedValueOnce(mockOBBResponse([]));
    await expect(getQuote("FAKE")).rejects.toThrow("No quote for FAKE");
  });
});

describe("searchEquity", () => {
  it("returns search results", async () => {
    const results = [{ symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ" }];
    mockFetch.mockResolvedValueOnce(mockOBBResponse(results));

    const result = await searchEquity("Apple");
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe("AAPL");
  });

  it("returns empty array for empty query", async () => {
    const result = await searchEquity("");
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns empty array for whitespace-only query", async () => {
    const result = await searchEquity("   ");
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("getIncomeStatement", () => {
  it("returns income statement rows", async () => {
    const rows = [{ date: "2023-09-30", period: "annual", revenue: 383285000000, net_income: 96995000000, eps: 6.13, ebitda: null, gross_profit: null }];
    mockFetch.mockResolvedValueOnce(mockOBBResponse(rows));

    const result = await getIncomeStatement("AAPL");
    expect(result).toHaveLength(1);
    expect(result[0].revenue).toBe(383285000000);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("equity/fundamental/income"),
      expect.anything()
    );
  });
});

describe("getNews", () => {
  it("returns news articles", async () => {
    const articles = [
      { date: "2024-01-10T10:00:00Z", title: "Apple announces new product", url: "https://example.com", source: "Reuters" },
    ];
    mockFetch.mockResolvedValueOnce(mockOBBResponse(articles));

    const result = await getNews("AAPL");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Apple announces new product");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("equity/news"),
      expect.anything()
    );
  });
});

describe("getFredSeries", () => {
  it("returns FRED series data", async () => {
    const series = [{ date: "2024-01-01", value: 5.33 }];
    mockFetch.mockResolvedValueOnce(mockOBBResponse(series));

    const result = await getFredSeries("DGS10");
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(5.33);
  });

  it("accepts optional startDate override", async () => {
    mockFetch.mockResolvedValueOnce(mockOBBResponse([]));
    await getFredSeries("FEDFUNDS", "2020-01-01");
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("start_date=2020-01-01");
  });
});

describe("getCryptoTop10", () => {
  it("returns successfully fetched quotes, skipping failed ones", async () => {
    // Simula: prima fetch OK, seconda fallisce, resto OK
    mockFetch
      .mockResolvedValueOnce(mockOBBResponse([{ symbol: "BTC-USD", price: 65000, day_change: 100, day_change_percent: 0.15 }]))
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValue(mockOBBResponse([{ symbol: "BNB-USD", price: 400, day_change: -5, day_change_percent: -1.2 }]));

    const result = await getCryptoTop10();
    // Deve restituire tutti quelli riusciti (non fallisce se alcuni falliscono)
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((q) => q.price > 0)).toBe(true);
  });
});
