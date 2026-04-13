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

export interface BandPoint {
  date: string;
  upper: number;
  middle: number | null;
  lower: number | null;
  price: number;
}

export interface SignalsResult {
  dates: string[];
  closes: number[];
  // Momentum
  rsi:        { date: string; value: number }[];
  macd_hist:  { date: string; value: number; macd: number | null; signal: number | null }[];
  cci:        { date: string; value: number }[];
  mfi:        { date: string; value: number }[];
  roc:        { date: string; value: number }[];
  stoch:      { date: string; k: number; d: number | null }[];
  williams_r: { date: string; value: number }[];
  adx:        { date: string; value: number }[];
  aroon:      { date: string; up: number; down: number | null }[];
  // Volatility
  atr:       { date: string; value: number }[];
  bbands:    BandPoint[];
  donchian:  BandPoint[];
  keltner:   BandPoint[];
  // Moving Averages
  moving_averages: {
    date: string; price: number;
    sma20: number | null; sma50: number | null; sma200: number | null;
    ema9: number | null; ema21: number | null; ema50: number | null; ema200: number | null;
    vwap: number | null;
  }[];
  // Volume
  obv: { date: string; value: number }[];
  ad:  { date: string; value: number }[];
  last: {
    rsi: number | null;
    macd_hist: number | null;
    bb_upper: number | null;
    bb_lower: number | null;
    atr: number | null;
    stoch_k: number | null;
    stoch_d: number | null;
    cci: number | null;
    mfi: number | null;
    roc: number | null;
    adx: number | null;
    williams_r: number | null;
    aroon_up: number | null;
    aroon_down: number | null;
    vwap: number | null;
    price: number | null;
  };
}

// ── Advanced (risposta /advanced/{ticker}) ────────────────────────────────────

export interface RegimePoint {
  date: string;
  regime: "Bull" | "Bear" | "High-Vol" | "Neutral";
  rolling_return: number;
  rolling_vol: number;
}

export interface LinearChannelPoint {
  date: string;
  price: number;
  mid: number;
  upper: number;
  lower: number;
}

export interface Pivots {
  pp: number;
  r1: number; r2: number; r3: number;
  s1: number; s2: number; s3: number;
}

export interface AdvancedResult {
  ticker: string;
  timeframe: string;
  // Mean reversion / regime
  hurst: number;
  ou_half_life: number | null;
  adf_pvalue: number | null;
  // Vol
  gk_vol: number;
  // Sizing
  kelly: number;
  // Regime
  regime_series: RegimePoint[];
  regime_summary: Record<string, number>;
  // Trend
  linear_channel: {
    slope_annualized: number;
    r_squared: number;
    series: LinearChannelPoint[];
  };
  // Pivots
  pivots: Pivots;
}

// ── Portfolio Optimization (risposta /portfolio/optimize) ─────────────────────

export interface PortfolioAllocation {
  weights: Record<string, number>;
  expected_return: number;
  volatility: number;
  sharpe: number;
}

export interface EfficientFrontierPoint {
  ret: number;
  vol: number;
}

export interface PortfolioOptimizeResult {
  tickers: string[];
  timeframe: string;
  max_sharpe: PortfolioAllocation;
  min_variance: PortfolioAllocation;
  risk_parity: PortfolioAllocation;
  efficient_frontier: EfficientFrontierPoint[];
}

// ── Quant (risposta /quant/{ticker}) ────────────────────────────────────────

export interface QuantResult {
  timeframe: string;
  // Core risk-adjusted
  annualized_vol: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  omega_ratio: number;
  ulcer_index: number;
  // Tail risk
  var_95: number;
  var_99: number;
  cvar_95: number;
  cvar_99: number;
  tail_ratio: number;
  // Distribution
  skewness: number;
  kurtosis: number;
  jb_pvalue: number;
  autocorr_lag1: number;
  mad_vol: number;
  // Trade statistics
  win_rate: number;
  payoff_ratio: number;
  gain_to_pain: number;
  // Drawdown
  max_drawdown: { value: number; duration_days: number };
  recovery_days: number | null;
  drawdown_series: { date: string; value: number }[];
  // Rolling windows
  rolling_vol: { date: string; value: number }[];
  rolling_sharpe: { date: string; value: number }[];
  histogram: { x: number; count: number }[];
  // Benchmark-dependent (optional)
  beta?: number;
  information_ratio?: number;
  treynor?: number;
  jensens_alpha?: number;
  rolling_beta?: { date: string; value: number }[];
  rolling_corr?: { date: string; value: number }[];
}
