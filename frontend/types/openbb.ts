// Struttura comune di ogni risposta OpenBB
export interface OBBResponse<T> {
  results: T[];
  provider: string;
  warnings: string[] | null;
  metadata: Record<string, unknown> | null;
}

// Prezzi storici (equity + crypto)
export interface PriceBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adj_close?: number;
}

// Quote (prezzo corrente)
export interface Quote {
  symbol: string;
  name?: string;
  price: number;
  day_change: number;
  day_change_percent: number;
  volume?: number;
  market_cap?: number;
  pe_ratio?: number;
}

// Ricerca ticker
export interface SearchResult {
  symbol: string;
  name: string;
  exchange?: string;
  currency?: string;
  security_type?: string;
}

// Fondamentali — conto economico
export interface IncomeStatement {
  date: string;
  period: string;
  revenue: number | null;
  net_income: number | null;
  eps: number | null;
  ebitda: number | null;
  gross_profit: number | null;
}

// Fondamentali — valutazione
export interface KeyMetrics {
  date: string;
  pe_ratio: number | null;
  price_to_book: number | null;
  price_to_sales: number | null;
  debt_to_equity: number | null;
  return_on_equity: number | null;
}

// News
export interface NewsArticle {
  date: string;
  title: string;
  text?: string;
  url: string;
  source?: string;
  symbols?: string[];
}

// Serie FRED (macro)
export interface FredSeries {
  date: string;
  value: number | null;
  realtime_start?: string;
  realtime_end?: string;
}

// Portfolio (dal CSV)
export interface PortfolioRow {
  ticker: string;
  quantity: number;
  buy_price: number;
  buy_date: string;
}

export interface PortfolioPosition extends PortfolioRow {
  current_price: number;
  current_value: number;
  cost_basis: number;
  gain_loss: number;
  gain_loss_pct: number;
}

// Errore generico
export interface ApiError {
  message: string;
  provider?: string;
}
