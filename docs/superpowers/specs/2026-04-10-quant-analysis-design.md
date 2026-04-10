# Quant Analysis Features — Design Spec

**Date:** 2026-04-10  
**Status:** Approved  
**Scope:** Two parallel tracks — (A) Extended technical indicators on existing equity page, (B) New `/analisi` quantitative statistics page

---

## Overview

Adds professional-grade quantitative analysis to the OpenBB Dashboard in two layers:

1. **Trading layer** — EMA overlay on price chart + 5 new technical indicators in SignalsPanel
2. **Quant layer** — New `/analisi` page with statistical/risk metrics over historical returns

All computations are client-side from OHLCV data already fetched. No new backend endpoints. One extra yfinance fetch for SPY (beta calculation only).

---

## Part A — EMA Overlay on PriceChart

### What changes

`PriceChart.tsx` gains an optional `emaLines` prop and toggle UI. The price chart continues to work unchanged when the prop is omitted (backward compatible).

### Props extension

```ts
interface EmaLine {
  period: number;        // 9 | 21 | 50 | 200
  values: number[];      // aligned to data array (NaN-padded at start)
  color: string;         // "#f59e0b" | "#a78bfa" | "#3b82f6" | "#6b7280"
  enabled: boolean;
}

interface Props {
  data: PriceBar[];
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  loading?: boolean;
  emaLines?: EmaLine[];              // NEW — optional
  onToggleEma?: (period: number) => void;  // NEW — optional
}
```

### EMA toggle bar

Rendered to the right of the timeframe buttons. Each pill shows period (e.g., "EMA9") with the indicator color. Clicking toggles `enabled`. Only active lines are rendered as `<Line>` elements in the Recharts chart.

EMA computation (in `equity/[ticker]/page.tsx`): uses `technicalindicators` `EMA.calculate()` already installed. The result is NaN-padded to match `data.length`. State: four booleans `ema9On / ema21On / ema50On / ema200On` managed in the page component, passed down as `emaLines`.

### Chart data shape

`chartData` items gain optional EMA fields:

```ts
{ date: string; close: number; ema9?: number; ema21?: number; ema50?: number; ema200?: number }
```

EMA values that are `NaN` or `undefined` cause Recharts to gap the line naturally — no special handling needed.

---

## Part B — Extended Indicators in SignalsPanel

### New indicators (all from `technicalindicators`)

| Indicator | Library call | Period | Output |
|-----------|-------------|--------|--------|
| ATR | `ATR.calculate({ high, low, close, period: 14 })` | 14 | Number[] — volatility in $ |
| Stochastic | `Stochastic.calculate({ high, low, close, period: 14, signalPeriod: 3 })` | 14,3 | `{k, d}[]` |
| ADX | `ADX.calculate({ high, low, close, period: 14 })` | 14 | `{adx, pdi, mdi}[]` |
| OBV | `OBV.calculate({ close, volume })` | — | Number[] |
| Williams %R | `WilliamsR.calculate({ high, low, close, period: 14 })` | 14 | Number[] (−100..0) |

### Display

- **ATR**: `IndicatorChart` with label "ATR (14)" — pure dollar value, no reference lines
- **Stochastic**: `IndicatorChart`-style chart with two lines (K=purple, D=amber), reference lines at 80 and 20
- **ADX**: `IndicatorChart` with ADX line only, reference line at 25 (trend threshold)
- **OBV**: `IndicatorChart` — raw cumulative volume, no reference lines
- **Williams %R**: `IndicatorChart`, domain [−100, 0], reference lines at −20 (overbought) and −80 (oversold)

### Summary grid

The existing 3-column summary grid expands to a 4-column grid (or 2-row × 3-column) to add ATR and Stochastic signal chips.

### Data requirements

`SignalsPanel` currently receives only `PriceBar[]` which has `{ date, open, high, low, close, volume }`. All new indicators need `high`, `low`, `volume` — already available. The `useMemo` deps stay `closesKey`; new indicators add `highLowKey = highs.join(",")` as separate dep key.

---

## Part C — New `/analisi` Page

### Route

`app/analisi/page.tsx` (client component) + `app/analisi/layout.tsx` (server, sets `<title>Analisi | OpenBB`).

### Data flow

```
page.tsx
  ├── reads watchlist from localStorage via useWatchlist()
  ├── ticker selector + timeframe selector (1Y default)
  ├── fetches getPriceHistory(ticker, timeframe)  -- existing function
  ├── fetches getPriceHistory("SPY", timeframe)   -- for beta only
  └── passes PriceBar[] to lib/quant.ts functions + child components
```

The SPY fetch is `Promise.allSettled`-wrapped so beta shows "N/A" if it fails.

### New file: `lib/quant.ts`

Pure functions, no React, fully unit-testable:

```ts
export function dailyReturns(closes: number[]): number[]
// returns (closes[i] - closes[i-1]) / closes[i-1]  (length = closes.length - 1)

export function annualizedVolatility(returns: number[]): number
// std(returns) * sqrt(252)

export function rollingVolatility(closes: number[], window: number = 30): number[]
// annualized vol of rolling window (length = closes.length - window)

export function sharpeRatio(returns: number[], riskFreeRate: number = 0.05): number
// (annualized mean return - riskFreeRate) / annualizedVolatility

export function maxDrawdown(closes: number[]): { value: number; durationDays: number }
// peak-to-trough max drawdown as fraction (−1..0) + days duration

export function drawdownSeries(closes: number[]): number[]
// array of drawdown at each point (for underwater chart)

export function correlationMatrix(series: number[][]): number[][]
// Pearson correlation between each pair; symmetric, diagonal = 1

export function beta(assetReturns: number[], benchmarkReturns: number[]): number
// covariance(asset, benchmark) / variance(benchmark)

export function histogram(values: number[], bins: number = 20): { x: number; count: number }[]
// for returns histogram chart
```

### Stat cards (5)

| Card | Computation | Color |
|------|------------|-------|
| Rendimento | `(last - first) / first * 100` | green/red |
| Volatilità Ann. | `annualizedVolatility(dailyReturns(closes)) * 100` | white |
| Sharpe Ratio | `sharpeRatio(returns, riskFreeAnnual)` | purple |
| Max Drawdown | `maxDrawdown(closes).value * 100` | red |
| Beta vs SPY | `beta(assetReturns, spyReturns)` | blue |

Risk-free rate: use the latest FRED FEDFUNDS value if available, fallback to 0.05.

### Charts (4)

1. **ReturnsHistogram** — bar chart of `histogram(dailyReturns)` with normal curve overlay (Recharts `ComposedChart` with `Bar` + `Line`)
2. **VolatilityChart** — `LineChart` of `rollingVolatility(closes, 30)` + `ReferenceLine` at mean
3. **DrawdownChart** — area chart (red fill) of `drawdownSeries(closes)` with `ReferenceLine` at 0
4. **CorrelationHeatmap** — CSS grid, all watchlist tickers; color intensity via inline `backgroundColor` interpolation (#1a1d27 → #3b82f6 based on correlation value)

### New components

All in `components/analisi/`:
- `QuantStatsCard.tsx` — single stat card with label/value/color
- `ReturnsHistogram.tsx` — takes `number[]` (returns), renders histogram
- `VolatilityChart.tsx` — takes `number[]` (closes), renders rolling vol
- `DrawdownChart.tsx` — takes `number[]` (closes), renders underwater chart
- `CorrelationHeatmap.tsx` — takes `{ ticker: string; closes: number[] }[]`, computes and renders matrix

---

## Testing

### `lib/quant.ts` — unit tests

File: `frontend/__tests__/lib/quant.test.ts`

| Test | Assertion |
|------|-----------|
| `dailyReturns` | length = n-1, correct first value |
| `annualizedVolatility` | known dataset → known result |
| `rollingVolatility` | length = closes - window, all positive |
| `sharpeRatio` | positive for steadily rising prices |
| `maxDrawdown` | correctly identifies peak-to-trough |
| `drawdownSeries` | starts at 0, all values ≤ 0 |
| `correlationMatrix` | diagonal = 1, symmetric, range [−1, 1] |
| `beta` | asset that mirrors benchmark → beta ≈ 1 |
| `histogram` | all counts sum to input length |

---

## File Checklist

**Modify:**
- `frontend/components/charts/PriceChart.tsx` — add `emaLines` prop + toggle UI
- `frontend/app/equity/[ticker]/page.tsx` — compute EMAs, pass to PriceChart
- `frontend/components/equity/SignalsPanel.tsx` — add ATR, Stochastic, ADX, OBV, Williams %R

**Create:**
- `frontend/lib/quant.ts`
- `frontend/app/analisi/layout.tsx`
- `frontend/app/analisi/page.tsx`
- `frontend/components/analisi/QuantStatsCard.tsx`
- `frontend/components/analisi/ReturnsHistogram.tsx`
- `frontend/components/analisi/VolatilityChart.tsx`
- `frontend/components/analisi/DrawdownChart.tsx`
- `frontend/components/analisi/CorrelationHeatmap.tsx`
- `frontend/__tests__/lib/quant.test.ts`

**No new npm packages** — all computations use `technicalindicators` (already installed) + vanilla math.
