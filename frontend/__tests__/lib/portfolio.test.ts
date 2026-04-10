import { describe, it, expect } from "vitest";
import { parseCSV, calcPositions } from "@/lib/portfolio";
import type { PortfolioRow, PortfolioPosition } from "@/types/openbb";

describe("parseCSV", () => {
  it("parses valid CSV", () => {
    const csv = "ticker,quantity,buy_price,buy_date\nAAPL,10,150.00,2023-01-15\nBTC,0.5,28000,2023-03-01";
    const result = parseCSV(csv);
    expect(result.rows).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.rows[0]).toEqual({ ticker: "AAPL", quantity: 10, buy_price: 150, buy_date: "2023-01-15" });
  });

  it("returns errors for rows with missing fields", () => {
    const csv = "ticker,quantity,buy_price,buy_date\nAAPL,,150.00,2023-01-15";
    const result = parseCSV(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("riga 2");
    expect(result.rows).toHaveLength(0);
  });

  it("returns error for non-numeric quantity", () => {
    const csv = "ticker,quantity,buy_price,buy_date\nAAPL,abc,150,2023-01-15";
    const result = parseCSV(csv);
    expect(result.errors[0]).toContain("quantity");
  });
});

describe("calcPositions", () => {
  it("calculates P&L correctly", () => {
    const rows: PortfolioRow[] = [{ ticker: "AAPL", quantity: 10, buy_price: 150, buy_date: "2023-01-15" }];
    const prices: Record<string, number> = { AAPL: 180 };
    const positions = calcPositions(rows, prices);

    expect(positions).toHaveLength(1);
    expect(positions[0].current_value).toBe(1800);
    expect(positions[0].cost_basis).toBe(1500);
    expect(positions[0].gain_loss).toBe(300);
    expect(positions[0].gain_loss_pct).toBeCloseTo(20, 1);
  });

  it("handles negative P&L", () => {
    const rows: PortfolioRow[] = [{ ticker: "AAPL", quantity: 10, buy_price: 200, buy_date: "2023-01-15" }];
    const prices: Record<string, number> = { AAPL: 150 };
    const positions = calcPositions(rows, prices);

    expect(positions[0].gain_loss).toBe(-500);
    expect(positions[0].gain_loss_pct).toBeCloseTo(-25, 1);
  });

  it("skips tickers with no current price", () => {
    const rows: PortfolioRow[] = [{ ticker: "AAPL", quantity: 10, buy_price: 150, buy_date: "2023-01-15" }];
    const positions = calcPositions(rows, {});
    expect(positions).toHaveLength(0);
  });

  it("aggrega righe duplicate con prezzo medio ponderato", () => {
    const rows: PortfolioRow[] = [
      { ticker: "AAPL", quantity: 10, buy_price: 150, buy_date: "2023-01-15" },
      { ticker: "AAPL", quantity: 5,  buy_price: 180, buy_date: "2023-06-01" },
    ];
    const prices = { AAPL: 200 };
    const positions = calcPositions(rows, prices);

    expect(positions).toHaveLength(1);
    expect(positions[0].quantity).toBe(15);
    // weighted avg: (10*150 + 5*180) / 15 = 2400/15 = 160
    expect(positions[0].buy_price).toBeCloseTo(160, 2);
    expect(positions[0].cost_basis).toBeCloseTo(2400, 2);
    expect(positions[0].current_value).toBe(3000);
    expect(positions[0].gain_loss).toBeCloseTo(600, 2);
  });

  it("mantiene ticker diversi come posizioni separate", () => {
    const rows: PortfolioRow[] = [
      { ticker: "AAPL", quantity: 10, buy_price: 150, buy_date: "2023-01-15" },
      { ticker: "MSFT", quantity: 5,  buy_price: 300, buy_date: "2023-01-15" },
    ];
    const prices = { AAPL: 200, MSFT: 350 };
    const positions = calcPositions(rows, prices);

    expect(positions).toHaveLength(2);
    expect(positions.map(p => p.ticker)).toContain("AAPL");
    expect(positions.map(p => p.ticker)).toContain("MSFT");
  });
});
