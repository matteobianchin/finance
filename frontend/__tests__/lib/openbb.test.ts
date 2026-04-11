import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getQuote, getPriceHistory, getSignals, getQuant, getScreenerData, getCryptoTop10 } from "@/lib/openbb";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockSuccess(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => data,
  } as Response);
}

function mockFailure(status = 500) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({}),
  } as Response);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Clear module-level cache between tests
  vi.resetModules();
});

describe("getQuote", () => {
  it("returns quote data from Domain API", async () => {
    const quote = { symbol: "AAPL", price: 175.5, day_change_percent: 1.2 };
    mockSuccess(quote);
    const result = await getQuote("AAPL");
    expect(result.symbol).toBe("AAPL");
    expect(result.price).toBe(175.5);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/quote/AAPL"),
      expect.any(Object)
    );
  });

  it("throws on non-ok response", async () => {
    mockFailure(404);
    await expect(getQuote("INVALID")).rejects.toThrow("Domain API error: 404");
  });
});

describe("getPriceHistory", () => {
  it("returns array of price bars", async () => {
    const bars = [
      { date: "2024-01-01", open: 100, high: 105, low: 99, close: 103, volume: 1000000 },
    ];
    mockSuccess(bars);
    const result = await getPriceHistory("AAPL", "1M");
    expect(result).toHaveLength(1);
    expect(result[0].close).toBe(103);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/history/AAPL"),
      expect.any(Object)
    );
  });
});

describe("getSignals", () => {
  it("returns SignalsResult with expected keys", async () => {
    const signals = {
      dates: ["2024-01-01"],
      closes: [175.0],
      rsi: [],
      macd_hist: [],
      bbands: [],
      atr: [],
      stoch: [],
      adx: [],
      obv: [],
      williams_r: [],
      last: { rsi: 62.4, macd_hist: 0.1, bb_upper: null, bb_lower: null,
              atr: 1.5, stoch_k: null, stoch_d: null, price: 175.0 },
    };
    mockSuccess(signals);
    const result = await getSignals("AAPL", "1M");
    expect(result.last.rsi).toBe(62.4);
    expect(result.williams_r).toBeDefined();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/signals/AAPL"),
      expect.any(Object)
    );
  });
});

describe("getQuant", () => {
  it("returns QuantResult with expected keys", async () => {
    const quant = {
      timeframe: "1Y",
      annualized_vol: 0.23,
      sharpe: 1.2,
      sortino: 1.5,
      calmar: 0.9,
      var_95: -0.02,
      var_99: -0.03,
      cvar_95: -0.025,
      skewness: -0.3,
      kurtosis: 3.1,
      max_drawdown: { value: -0.18, duration_days: 45 },
      drawdown_series: [],
      rolling_vol: [],
      rolling_sharpe: [],
      histogram: [],
    };
    mockSuccess(quant);
    const result = await getQuant("AAPL", "1Y");
    expect(result.sharpe).toBe(1.2);
    expect(result.max_drawdown.value).toBe(-0.18);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/quant/AAPL"),
      expect.any(Object)
    );
  });
});

describe("getScreenerData", () => {
  it("returns array with screener rows", async () => {
    const rows = [
      { ticker: "AAPL", price: 175, change1d: 1.2, rsi: 62, return1m: 4.5 },
    ];
    mockSuccess(rows);
    const result = await getScreenerData(["AAPL"]);
    expect(result).toHaveLength(1);
    expect(result[0].ticker).toBe("AAPL");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/screener"),
      expect.any(Object)
    );
  });
});

describe("getCryptoTop10", () => {
  it("calls /crypto/top endpoint", async () => {
    mockSuccess([{ symbol: "BTC-USD", price: 68000 }]);
    const result = await getCryptoTop10();
    expect(result).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/crypto/top"),
      expect.any(Object)
    );
  });
});
