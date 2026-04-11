// Timeframe per grafici prezzi
export type Timeframe = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "5Y";

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

// Fondamentali unificati (risposta /fundamentals/{ticker})
export interface FundamentalsResult {
  income: IncomeStatement[];
  metrics: KeyMetrics[];
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

// Earnings calendar
export interface EarningsEvent {
  symbol: string;
  date: string;
  eps_estimate?: number;
  eps_actual?: number;
  revenue_estimate?: number;
  revenue_actual?: number;
}

// Errore generico
export interface ApiError {
  message: string;
  provider?: string;
}

// ── Signals (risposta /signals/{ticker}) ────────────────────────────────────

export interface SignalsResult {
  dates: string[];
  closes: number[];
  rsi: { date: string; value: number }[];
  macd_hist: { date: string; value: number; macd: number | null; signal: number | null }[];
  bbands: { date: string; upper: number; middle: number | null; lower: number | null; price: number }[];
  atr: { date: string; value: number }[];
  stoch: { date: string; k: number; d: number | null }[];
  adx: { date: string; value: number }[];
  obv: { date: string; value: number }[];
  williams_r: { date: string; value: number }[];
  last: {
    rsi: number | null;
    macd_hist: number | null;
    bb_upper: number | null;
    bb_lower: number | null;
    atr: number | null;
    stoch_k: number | null;
    stoch_d: number | null;
    price: number | null;
  };
}

// ── Quant (risposta /quant/{ticker}) ────────────────────────────────────────

export interface QuantResult {
  timeframe: string;
  annualized_vol: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  var_95: number;
  var_99: number;
  cvar_95: number;
  skewness: number;
  kurtosis: number;
  max_drawdown: { value: number; duration_days: number };
  drawdown_series: { date: string; value: number }[];
  rolling_vol: { date: string; value: number }[];
  rolling_sharpe: { date: string; value: number }[];
  rolling_beta?: { date: string; value: number }[];
  beta?: number;
  histogram: { x: number; count: number }[];
}
