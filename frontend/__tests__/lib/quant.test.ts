import { describe, it, expect } from "vitest";
import {
  dailyReturns,
  annualizedVolatility,
  rollingVolatility,
  sharpeRatio,
  maxDrawdown,
  drawdownSeries,
  correlationMatrix,
  beta,
  histogram,
} from "@/lib/quant";

// Simple linearly increasing price series: 100, 101, 102, ..., 109
const linear = Array.from({ length: 10 }, (_, i) => 100 + i);

describe("dailyReturns", () => {
  it("returns length n-1", () => {
    expect(dailyReturns(linear)).toHaveLength(9);
  });
  it("first return is (101-100)/100 = 0.01", () => {
    expect(dailyReturns(linear)[0]).toBeCloseTo(0.01, 5);
  });
  it("returns empty array for single price", () => {
    expect(dailyReturns([100])).toHaveLength(0);
  });
});

describe("annualizedVolatility", () => {
  it("returns a positive number for varying prices", () => {
    const returns = dailyReturns(linear);
    expect(annualizedVolatility(returns)).toBeGreaterThan(0);
  });
  it("constant returns have zero vol", () => {
    expect(annualizedVolatility([0.01, 0.01, 0.01])).toBeCloseTo(0, 5);
  });
  it("returns 0 for fewer than 2 data points", () => {
    expect(annualizedVolatility([0.01])).toBe(0);
  });
});

describe("rollingVolatility", () => {
  it("length = closes.length - window", () => {
    expect(rollingVolatility(linear, 3)).toHaveLength(7);
  });
  it("all values >= 0", () => {
    rollingVolatility(linear, 3).forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
  });
  it("returns empty if closes shorter than window", () => {
    expect(rollingVolatility([100, 101], 5)).toHaveLength(0);
  });
});

describe("sharpeRatio", () => {
  it("positive for steady up-trend with rf=0", () => {
    expect(sharpeRatio(dailyReturns(linear), 0)).toBeGreaterThan(0);
  });
  it("returns 0 when vol is 0", () => {
    expect(sharpeRatio([0, 0, 0], 0.05)).toBe(0);
  });
  it("returns 0 for fewer than 2 data points", () => {
    expect(sharpeRatio([0.01])).toBe(0);
  });
});

describe("maxDrawdown", () => {
  it("flat prices → drawdown 0", () => {
    const result = maxDrawdown([100, 100, 100]);
    expect(result.value).toBe(0);
  });
  it("detects correct peak-to-trough", () => {
    // peak 100 → trough 50 → recover 80
    const result = maxDrawdown([100, 90, 50, 70, 80]);
    expect(result.value).toBeCloseTo(-0.5, 3);
  });
  it("always increasing returns drawdown 0", () => {
    const result = maxDrawdown([10, 20, 30, 40]);
    expect(result.value).toBe(0);
  });
});

describe("drawdownSeries", () => {
  it("starts at 0 for first price equal to peak", () => {
    expect(drawdownSeries([100, 110, 90])[0]).toBe(0);
  });
  it("all values <= 0", () => {
    drawdownSeries([100, 110, 90, 120]).forEach((v) =>
      expect(v).toBeLessThanOrEqual(0)
    );
  });
  it("returns 0 at new highs", () => {
    const series = drawdownSeries([100, 90, 110]);
    expect(series[2]).toBeCloseTo(0, 5); // 110 is new high
  });
});

describe("correlationMatrix", () => {
  it("diagonal is 1", () => {
    const a = [1, 2, 3, 4, 5];
    const mat = correlationMatrix([a, a]);
    expect(mat[0][0]).toBeCloseTo(1, 5);
    expect(mat[1][1]).toBeCloseTo(1, 5);
  });
  it("perfectly correlated series → 1", () => {
    const a = [1, 2, 3];
    const b = [2, 4, 6];
    const mat = correlationMatrix([a, b]);
    expect(mat[0][1]).toBeCloseTo(1, 3);
  });
  it("perfectly negatively correlated → -1", () => {
    const a = [1, 2, 3];
    const b = [3, 2, 1];
    const mat = correlationMatrix([a, b]);
    expect(mat[0][1]).toBeCloseTo(-1, 3);
  });
  it("matrix is symmetric", () => {
    const a = [1, 3, 2, 5];
    const b = [2, 1, 4, 3];
    const mat = correlationMatrix([a, b]);
    expect(mat[0][1]).toBeCloseTo(mat[1][0], 5);
  });
});

describe("beta", () => {
  it("series that mirrors benchmark → beta ≈ 1", () => {
    const bm = [0.01, -0.02, 0.015, -0.005, 0.02];
    expect(beta(bm, bm)).toBeCloseTo(1, 5);
  });
  it("series 2x benchmark → beta ≈ 2", () => {
    const bm = [0.01, -0.02, 0.015];
    const asset = bm.map((r) => r * 2);
    expect(beta(asset, bm)).toBeCloseTo(2, 3);
  });
  it("returns 0 when benchmark has zero variance", () => {
    expect(beta([0.01, 0.02], [0, 0])).toBe(0);
  });
});

describe("histogram", () => {
  it("total count equals input length", () => {
    const values = Array.from({ length: 100 }, (_, i) => (i - 50) / 100);
    const bins = histogram(values, 10);
    const total = bins.reduce((s, b) => s + b.count, 0);
    expect(total).toBe(100);
  });
  it("returns requested bin count", () => {
    const values = [0.01, 0.02, -0.01, 0.03];
    expect(histogram(values, 5)).toHaveLength(5);
  });
  it("returns empty for empty input", () => {
    expect(histogram([])).toHaveLength(0);
  });
});
