import Papa from "papaparse";
import type { PortfolioRow, PortfolioPosition } from "@/types/openbb";

interface ParseResult {
  rows: PortfolioRow[];
  errors: string[];
}

export function parseCSV(csvText: string): ParseResult {
  const errors: string[] = [];
  const rows: PortfolioRow[] = [];

  const parsed = Papa.parse<Record<string, string>>(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  parsed.data.forEach((row, i) => {
    const lineNum = i + 2; // header è riga 1
    const rowErrors: string[] = [];

    const ticker = row["ticker"]?.trim().toUpperCase();
    const quantity = parseFloat(row["quantity"]);
    const buy_price = parseFloat(row["buy_price"]);
    const buy_date = row["buy_date"]?.trim();

    if (!ticker) rowErrors.push(`ticker mancante`);
    if (isNaN(quantity) || quantity <= 0) rowErrors.push(`quantity non valida`);
    if (isNaN(buy_price) || buy_price <= 0) rowErrors.push(`buy_price non valida`);
    if (!buy_date || !/^\d{4}-\d{2}-\d{2}$/.test(buy_date)) {
      rowErrors.push(`buy_date deve essere YYYY-MM-DD`);
    }

    if (rowErrors.length > 0) {
      errors.push(`riga ${lineNum}: ${rowErrors.join(", ")}`);
    } else {
      rows.push({ ticker, quantity, buy_price, buy_date });
    }
  });

  return { rows: errors.length === 0 ? rows : [], errors };
}

/**
 * Aggrega righe con lo stesso ticker usando prezzo medio ponderato.
 * Es: 10 AAPL a $150 + 5 AAPL a $180 → 15 AAPL a $160 (weighted avg).
 */
function aggregateRows(rows: PortfolioRow[]): PortfolioRow[] {
  const map = new Map<string, { quantity: number; totalCost: number; buy_date: string }>();

  rows.forEach((row) => {
    const existing = map.get(row.ticker);
    if (existing) {
      existing.totalCost += row.quantity * row.buy_price;
      existing.quantity += row.quantity;
    } else {
      map.set(row.ticker, {
        quantity: row.quantity,
        totalCost: row.quantity * row.buy_price,
        buy_date: row.buy_date,
      });
    }
  });

  return Array.from(map.entries()).map(([ticker, { quantity, totalCost, buy_date }]) => ({
    ticker,
    quantity,
    buy_price: totalCost / quantity,
    buy_date,
  }));
}

export function calcPositions(
  rows: PortfolioRow[],
  prices: Record<string, number>
): PortfolioPosition[] {
  return aggregateRows(rows)
    .filter((row) => prices[row.ticker] !== undefined)
    .map((row) => {
      const current_price = prices[row.ticker];
      const cost_basis = row.quantity * row.buy_price;
      const current_value = row.quantity * current_price;
      const gain_loss = current_value - cost_basis;
      const gain_loss_pct = (gain_loss / cost_basis) * 100;

      return {
        ...row,
        current_price,
        current_value,
        cost_basis,
        gain_loss,
        gain_loss_pct,
      };
    });
}

export function totalPortfolioValue(positions: PortfolioPosition[]): number {
  return positions.reduce((sum, p) => sum + p.current_value, 0);
}

export function totalCostBasis(positions: PortfolioPosition[]): number {
  return positions.reduce((sum, p) => sum + p.cost_basis, 0);
}
