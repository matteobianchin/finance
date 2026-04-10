/** Mean of an array */
function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

/** Population standard deviation */
function stdDev(arr: number[]): number {
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

/** (closes[i] - closes[i-1]) / closes[i-1] */
export function dailyReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    out.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  return out;
}

/** Annualized volatility: std(returns) * sqrt(252) */
export function annualizedVolatility(returns: number[]): number {
  if (returns.length < 2) return 0;
  return stdDev(returns) * Math.sqrt(252);
}

/**
 * Rolling annualized volatility with given window.
 * Result length = closes.length - window.
 */
export function rollingVolatility(closes: number[], window = 30): number[] {
  if (closes.length <= window) return [];
  const out: number[] = [];
  for (let i = window; i < closes.length; i++) {
    const slice = closes.slice(i - window, i);
    out.push(annualizedVolatility(dailyReturns(slice)));
  }
  return out;
}

/**
 * Sharpe Ratio = (annualized mean return - riskFreeRate) / annualizedVol
 * Returns 0 when vol is 0.
 */
export function sharpeRatio(returns: number[], riskFreeRate = 0.05): number {
  if (returns.length < 2) return 0;
  const vol = annualizedVolatility(returns);
  if (vol === 0) return 0;
  const annualMean = mean(returns) * 252;
  return (annualMean - riskFreeRate) / vol;
}

/** Peak-to-trough maximum drawdown as fraction (0 = no drawdown, -0.5 = -50%) */
export function maxDrawdown(closes: number[]): { value: number; durationDays: number } {
  let peak = closes[0];
  let maxDD = 0;
  let troughIdx = 0;
  let peakIdx = 0;
  let maxDuration = 0;

  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > peak) {
      peak = closes[i];
      peakIdx = i;
    }
    const dd = (closes[i] - peak) / peak;
    if (dd < maxDD) {
      maxDD = dd;
      troughIdx = i;
      maxDuration = troughIdx - peakIdx;
    }
  }

  return { value: maxDD, durationDays: maxDuration };
}

/** Drawdown at each point: (price - running_peak) / running_peak, all <= 0 */
export function drawdownSeries(closes: number[]): number[] {
  const out: number[] = [];
  let peak = closes[0];
  for (const close of closes) {
    if (close > peak) peak = close;
    out.push((close - peak) / peak);
  }
  return out;
}

/** Pearson correlation between two series of equal length */
function pearsonCorrelation(a: number[], b: number[]): number {
  const ma = mean(a);
  const mb = mean(b);
  let num = 0,
    da = 0,
    db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  const denom = Math.sqrt(da * db);
  return denom === 0 ? 0 : num / denom;
}

/** NxN Pearson correlation matrix. Diagonal = 1, symmetric. */
export function correlationMatrix(series: number[][]): number[][] {
  const n = series.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (__, j) =>
      i === j ? 1 : pearsonCorrelation(series[i], series[j])
    )
  );
}

/** Beta = cov(asset, benchmark) / var(benchmark). Returns 0 if var(benchmark) = 0. */
export function beta(assetReturns: number[], benchmarkReturns: number[]): number {
  const len = Math.min(assetReturns.length, benchmarkReturns.length);
  const a = assetReturns.slice(0, len);
  const b = benchmarkReturns.slice(0, len);
  const mb = mean(b);
  const ma = mean(a);
  let cov = 0,
    varB = 0;
  for (let i = 0; i < len; i++) {
    cov += (a[i] - ma) * (b[i] - mb);
    varB += (b[i] - mb) ** 2;
  }
  return varB === 0 ? 0 : cov / varB;
}

/** Frequency histogram: divide range into `bins` equal buckets. */
export function histogram(
  values: number[],
  bins = 20
): { x: number; count: number }[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = range / bins;

  const counts = Array.from({ length: bins }, (_, i) => ({
    x: min + step * i + step / 2,
    count: 0,
  }));

  for (const v of values) {
    const idx = Math.min(bins - 1, Math.floor((v - min) / step));
    counts[idx].count++;
  }

  return counts;
}
