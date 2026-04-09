import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPriceHistory,
  getQuote,
  searchEquity,
  getIncomeStatement,
  getNews,
  getFredSeries,
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
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:6900";
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
});

describe("getFredSeries", () => {
  it("returns FRED series data", async () => {
    const series = [{ date: "2024-01-01", value: 5.33 }];
    mockFetch.mockResolvedValueOnce(mockOBBResponse(series));

    const result = await getFredSeries("DGS10");
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(5.33);
  });
});
