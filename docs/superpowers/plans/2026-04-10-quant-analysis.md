# Quant Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `lib/quant.ts` pure-math library, a new `/analisi` page with 5 stat cards + 4 charts, EMA overlay toggles on PriceChart, and 5 new indicators (ATR, Stochastic, ADX, OBV, Williams %R) in SignalsPanel.

**Architecture:** All computation is client-side from OHLCV data already fetched via `getPriceHistory`. A new `lib/quant.ts` module contains pure functions (no React) for statistical metrics. New `components/analisi/` components consume those functions. `PriceChart` gains an optional `emaLines` prop. `SignalsPanel` adds 5 indicators using `technicalindicators` already installed.

**Tech Stack:** Next.js 14, React, Recharts, `technicalindicators`, Vitest — no new packages.

---

## File Map

**New files:**
- `frontend/lib/quant.ts` — pure statistical functions
- `frontend/__tests__/lib/quant.test.ts` — unit tests for quant.ts
- `frontend/app/analisi/layout.tsx` — server component, sets page title
- `frontend/app/analisi/page.tsx` — client page: ticker/timeframe selector + stat cards + charts
- `frontend/components/analisi/QuantStatsCard.tsx` — single metric card
- `frontend/components/analisi/ReturnsHistogram.tsx` — daily returns histogram with normal overlay
- `frontend/components/analisi/VolatilityChart.tsx` — rolling 30d vol line chart
- `frontend/components/analisi/DrawdownChart.tsx` — underwater area chart
- `frontend/components/analisi/CorrelationHeatmap.tsx` — CSS-grid heatmap for watchlist

**Modified files:**
- `frontend/components/charts/PriceChart.tsx` — add optional `emaLines` prop + toggle buttons
- `frontend/app/equity/[ticker]/page.tsx` — compute EMAs and pass to PriceChart
- `frontend/components/equity/SignalsPanel.tsx` — add ATR, Stochastic, ADX, OBV, Williams %R
- `frontend/components/layout/Sidebar.tsx` — add `/analisi` nav entry

---

## Task 1: lib/quant.ts — pure functions

**Files:**
- Create: `frontend/lib/quant.ts`
- Create: `frontend/__tests__/lib/quant.test.ts`

- [ ] **Step 1: Write failing tests**

Create `frontend/__tests__/lib/quant.test.ts`:

```ts
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
});

describe("annualizedVolatility", () => {
  it("returns a positive number", () => {
    const returns = dailyReturns(linear);
    expect(annualizedVolatility(returns)).toBeGreaterThan(0);
  });
  it("constant returns have zero vol", () => {
    expect(annualizedVolatility([0.01, 0.01, 0.01])).toBeCloseTo(0, 5);
  });
});

describe("rollingVolatility", () => {
  it("length = closes.length - window", () => {
    expect(rollingVolatility(linear, 3)).toHaveLength(7);
  });
  it("all values >= 0", () => {
    rollingVolatility(linear, 3).forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
  });
});

describe("sharpeRatio", () => {
  it("positive for steady up-trend", () => {
    expect(sharpeRatio(dailyReturns(linear), 0)).toBeGreaterThan(0);
  });
  it("returns 0 when vol is 0 and mean <= rf", () => {
    expect(sharpeRatio([0, 0, 0], 0.05)).toBe(0);
  });
});

describe("maxDrawdown", () => {
  it("flat prices → drawdown 0", () => {
    const result = maxDrawdown([100, 100, 100]);
    expect(result.value).toBe(0);
  });
  it("detects correct trough", () => {
    // peak 100 → trough 50 → recover 80
    const result = maxDrawdown([100, 90, 50, 70, 80]);
    expect(result.value).toBeCloseTo(-0.5, 3);
  });
});

describe("drawdownSeries", () => {
  it("starts at 0", () => {
    expect(drawdownSeries([100, 110, 90])[0]).toBe(0);
  });
  it("all values <= 0", () => {
    drawdownSeries([100, 110, 90, 120]).forEach((v) => expect(v).toBeLessThanOrEqual(0));
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
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | grep -E "FAIL|PASS|Error" | head -20
```

Expected: fails with "Cannot find module '@/lib/quant'"

- [ ] **Step 3: Implement lib/quant.ts**

Create `frontend/lib/quant.ts`:

```ts
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
  let num = 0, da = 0, db = 0;
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
  let cov = 0, varB = 0;
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
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | tail -30
```

Expected: all quant tests pass.

- [ ] **Step 5: Commit**

```bash
cd frontend && git add lib/quant.ts __tests__/lib/quant.test.ts
git commit -m "feat: lib/quant.ts — pure statistical functions (returns, vol, sharpe, drawdown, correlation, beta, histogram)"
```

---

## Task 2: QuantStatsCard + Sidebar entry

**Files:**
- Create: `frontend/components/analisi/QuantStatsCard.tsx`
- Modify: `frontend/components/layout/Sidebar.tsx`

- [ ] **Step 1: Create QuantStatsCard.tsx**

```tsx
interface Props {
  label: string;
  value: string;
  color?: string; // tailwind text class e.g. "text-positive"
  subtext?: string;
}

export default function QuantStatsCard({ label, value, color = "text-white", subtext }: Props) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-muted text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {subtext && <p className="text-muted text-xs mt-1">{subtext}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Add /analisi to Sidebar**

In `frontend/components/layout/Sidebar.tsx`, add `{ href: "/analisi", label: "Analisi", icon: FlaskConical }` to NAV array. Import `FlaskConical` from `lucide-react`.

The NAV array should become:
```tsx
import { BarChart2, TrendingUp, Globe, Briefcase, LayoutDashboard, Search, FlaskConical } from "lucide-react";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/equity/AAPL", label: "Azioni", icon: TrendingUp },
  { href: "/crypto", label: "Crypto", icon: BarChart2 },
  { href: "/macro", label: "Macro", icon: Globe },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase },
  { href: "/analisi", label: "Analisi", icon: FlaskConical },
];
```

- [ ] **Step 3: Commit**

```bash
cd frontend && git add components/analisi/QuantStatsCard.tsx components/layout/Sidebar.tsx
git commit -m "feat: QuantStatsCard component + Analisi nav entry"
```

---

## Task 3: ReturnsHistogram

**Files:**
- Create: `frontend/components/analisi/ReturnsHistogram.tsx`

- [ ] **Step 1: Create ReturnsHistogram.tsx**

```tsx
"use client";

import { useMemo } from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { histogram, dailyReturns } from "@/lib/quant";

interface Props {
  closes: number[];
}

// Normal distribution PDF for overlay
function normalPdf(x: number, mu: number, sigma: number): number {
  if (sigma === 0) return 0;
  return Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));
}

function skewness(values: number[]): number {
  const n = values.length;
  const m = values.reduce((s, v) => s + v, 0) / n;
  const s = Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / n);
  if (s === 0) return 0;
  return values.reduce((sum, v) => sum + ((v - m) / s) ** 3, 0) / n;
}

function kurtosis(values: number[]): number {
  const n = values.length;
  const m = values.reduce((s, v) => s + v, 0) / n;
  const s = Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / n);
  if (s === 0) return 0;
  return values.reduce((sum, v) => sum + ((v - m) / s) ** 4, 0) / n;
}

export default function ReturnsHistogram({ closes }: Props) {
  const returns = useMemo(() => dailyReturns(closes), [closes.join(",")]);

  const data = useMemo(() => {
    if (returns.length === 0) return [];
    const bins = histogram(returns, 25);
    const mu = returns.reduce((s, v) => s + v, 0) / returns.length;
    const sigma = Math.sqrt(returns.reduce((s, v) => s + (v - mu) ** 2, 0) / returns.length);
    const maxCount = Math.max(...bins.map((b) => b.count));
    return bins.map((b) => ({
      x: (b.x * 100).toFixed(2) + "%",
      count: b.count,
      normal: normalPdf(b.x, mu, sigma) * returns.length * (bins[1]?.x - bins[0]?.x || 0.001),
      normalScaled: (normalPdf(b.x, mu, sigma) / normalPdf(mu, mu, sigma)) * maxCount,
    }));
  }, [returns.join(",")]);

  const mu = returns.length ? returns.reduce((s, v) => s + v, 0) / returns.length : 0;
  const skew = returns.length ? skewness(returns) : 0;
  const kurt = returns.length ? kurtosis(returns) : 0;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-muted text-xs uppercase tracking-wide mb-3">Distribuzione Rendimenti Giornalieri</p>
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
          <XAxis dataKey="x" tick={{ fontSize: 9, fill: "#6b7280" }} interval={4} />
          <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} />
          <Tooltip
            contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }}
            formatter={(v: number, name: string) => [v.toFixed(1), name === "count" ? "Frequenza" : "Normale"]}
          />
          <Bar dataKey="count" fill="#3b82f6" opacity={0.7} isAnimationActive={false} />
          <Line type="monotone" dataKey="normalScaled" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} name="Curva normale" />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2">
        <span className="text-muted text-xs">Media: <strong className={mu >= 0 ? "text-positive" : "text-negative"}>{(mu * 100).toFixed(3)}%</strong></span>
        <span className="text-muted text-xs">Skew: <strong className="text-white">{skew.toFixed(2)}</strong></span>
        <span className="text-muted text-xs">Kurtosis: <strong className="text-white">{kurt.toFixed(2)}</strong></span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd frontend && git add components/analisi/ReturnsHistogram.tsx
git commit -m "feat: ReturnsHistogram component with normal curve overlay"
```

---

## Task 4: VolatilityChart + DrawdownChart

**Files:**
- Create: `frontend/components/analisi/VolatilityChart.tsx`
- Create: `frontend/components/analisi/DrawdownChart.tsx`

- [ ] **Step 1: Create VolatilityChart.tsx**

```tsx
"use client";

import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { rollingVolatility } from "@/lib/quant";

interface Props {
  closes: number[];
  dates: string[];
}

export default function VolatilityChart({ closes, dates }: Props) {
  const window = 30;
  const volData = useMemo(() => {
    const vols = rollingVolatility(closes, window);
    return vols.map((v, i) => ({
      date: dates[window + i]?.slice(0, 10) ?? "",
      vol: parseFloat((v * 100).toFixed(2)),
    }));
  }, [closes.join(",")]);

  const avg = volData.length
    ? volData.reduce((s, d) => s + d.vol, 0) / volData.length
    : 0;
  const current = volData.at(-1)?.vol ?? 0;
  const maxVol = volData.reduce((m, d) => Math.max(m, d.vol), 0);

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-muted text-xs uppercase tracking-wide mb-3">Volatilità Rolling 30d (annualizzata)</p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={volData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} tickFormatter={(v) => v.slice(5)} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} tickFormatter={(v) => `${v}%`} />
          <Tooltip
            contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }}
            formatter={(v: number) => [`${v.toFixed(1)}%`, "Volatilità"]}
          />
          <ReferenceLine y={avg} stroke="#6b7280" strokeDasharray="4 4" label={{ value: "avg", fill: "#6b7280", fontSize: 9 }} />
          <Line type="monotone" dataKey="vol" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2">
        <span className="text-muted text-xs">Attuale: <strong className="text-amber-400">{current.toFixed(1)}%</strong></span>
        <span className="text-muted text-xs">Media: <strong className="text-white">{avg.toFixed(1)}%</strong></span>
        <span className="text-muted text-xs">Max: <strong className="text-negative">{maxVol.toFixed(1)}%</strong></span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create DrawdownChart.tsx**

```tsx
"use client";

import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { drawdownSeries, maxDrawdown } from "@/lib/quant";

interface Props {
  closes: number[];
  dates: string[];
}

export default function DrawdownChart({ closes, dates }: Props) {
  const dd = useMemo(() => drawdownSeries(closes), [closes.join(",")]);
  const { value: maxDD, durationDays } = useMemo(() => maxDrawdown(closes), [closes.join(",")]);

  const data = dd.map((v, i) => ({
    date: dates[i]?.slice(0, 10) ?? "",
    dd: parseFloat((v * 100).toFixed(2)),
  }));

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-muted text-xs uppercase tracking-wide mb-3">Drawdown (Underwater Chart)</p>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} tickFormatter={(v) => v.slice(5)} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} tickFormatter={(v) => `${v}%`} domain={["auto", 0]} />
          <Tooltip
            contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }}
            formatter={(v: number) => [`${v.toFixed(2)}%`, "Drawdown"]}
          />
          <ReferenceLine y={0} stroke="#22c55e" strokeOpacity={0.5} />
          <Area type="monotone" dataKey="dd" stroke="#ef4444" strokeWidth={1.5} fill="#ef444420" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2">
        <span className="text-muted text-xs">Max Drawdown: <strong className="text-negative">{(maxDD * 100).toFixed(1)}%</strong></span>
        <span className="text-muted text-xs">Durata: <strong className="text-white">{durationDays} giorni</strong></span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd frontend && git add components/analisi/VolatilityChart.tsx components/analisi/DrawdownChart.tsx
git commit -m "feat: VolatilityChart and DrawdownChart components"
```

---

## Task 5: CorrelationHeatmap

**Files:**
- Create: `frontend/components/analisi/CorrelationHeatmap.tsx`

- [ ] **Step 1: Create CorrelationHeatmap.tsx**

```tsx
"use client";

import { useMemo } from "react";
import { correlationMatrix } from "@/lib/quant";

interface TickerSeries {
  ticker: string;
  closes: number[];
}

interface Props {
  series: TickerSeries[];
}

function corrColor(value: number): string {
  // 1 → deep blue, 0 → dark bg, -1 → deep red
  if (value >= 0) {
    const intensity = Math.round(value * 90);
    return `rgba(59, 130, 246, ${value.toFixed(2)})`; // blue
  }
  return `rgba(239, 68, 68, ${Math.abs(value).toFixed(2)})`; // red
}

export default function CorrelationHeatmap({ series }: Props) {
  const tickers = series.map((s) => s.ticker);
  const matrix = useMemo(() => {
    const returns = series.map((s) => {
      const r: number[] = [];
      for (let i = 1; i < s.closes.length; i++) {
        r.push((s.closes[i] - s.closes[i - 1]) / s.closes[i - 1]);
      }
      return r;
    });
    // Align all to same length (min)
    const minLen = Math.min(...returns.map((r) => r.length));
    return correlationMatrix(returns.map((r) => r.slice(r.length - minLen)));
  }, [series.map((s) => s.ticker + s.closes.length).join(",")]);

  if (series.length < 2) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-muted text-xs uppercase tracking-wide mb-3">Correlazione Watchlist</p>
        <p className="text-muted text-sm">Aggiungi almeno 2 ticker alla watchlist per la matrice di correlazione.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-muted text-xs uppercase tracking-wide mb-3">Correlazione Watchlist</p>
      <div className="overflow-x-auto">
        <div
          style={{ display: "grid", gridTemplateColumns: `60px repeat(${tickers.length}, 1fr)`, gap: 2, fontSize: 11 }}
        >
          {/* Header row */}
          <div />
          {tickers.map((t) => (
            <div key={t} className="text-muted text-center py-1 font-medium truncate">{t}</div>
          ))}
          {/* Data rows */}
          {tickers.map((rowTicker, i) => (
            <>
              <div key={rowTicker} className="text-muted py-1 font-medium truncate">{rowTicker}</div>
              {tickers.map((_, j) => {
                const val = matrix[i]?.[j] ?? 0;
                return (
                  <div
                    key={j}
                    style={{ background: corrColor(val), borderRadius: 3, padding: "5px 4px", textAlign: "center", color: "#fff", fontWeight: 600 }}
                  >
                    {val.toFixed(2)}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd frontend && git add components/analisi/CorrelationHeatmap.tsx
git commit -m "feat: CorrelationHeatmap component"
```

---

## Task 6: /analisi page

**Files:**
- Create: `frontend/app/analisi/layout.tsx`
- Create: `frontend/app/analisi/page.tsx`

- [ ] **Step 1: Create layout.tsx**

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Analisi | OpenBB" };

export default function AnalisiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 2: Create page.tsx**

```tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { getPriceHistory } from "@/lib/openbb";
import { dailyReturns, annualizedVolatility, sharpeRatio, maxDrawdown, beta } from "@/lib/quant";
import { useWatchlist } from "@/components/overview/WatchlistManager";
import QuantStatsCard from "@/components/analisi/QuantStatsCard";
import ReturnsHistogram from "@/components/analisi/ReturnsHistogram";
import VolatilityChart from "@/components/analisi/VolatilityChart";
import DrawdownChart from "@/components/analisi/DrawdownChart";
import CorrelationHeatmap from "@/components/analisi/CorrelationHeatmap";
import type { PriceBar, Timeframe } from "@/types/openbb";

const TIMEFRAMES: Timeframe[] = ["3M", "6M", "1Y", "5Y"];

export default function AnalisiPage() {
  const { tickers } = useWatchlist();
  const [selectedTicker, setSelectedTicker] = useState<string>("");
  const [timeframe, setTimeframe] = useState<Timeframe>("1Y");
  const [history, setHistory] = useState<PriceBar[]>([]);
  const [spyHistory, setSpyHistory] = useState<PriceBar[]>([]);
  const [corrSeries, setCorrSeries] = useState<{ ticker: string; closes: number[] }[]>([]);
  const [loading, setLoading] = useState(false);

  // Set default ticker when watchlist loads
  useEffect(() => {
    if (tickers.length > 0 && !selectedTicker) {
      setSelectedTicker(tickers[0]);
    }
  }, [tickers]);

  // Fetch main ticker + SPY for beta
  useEffect(() => {
    if (!selectedTicker) return;
    setLoading(true);
    Promise.allSettled([
      getPriceHistory(selectedTicker, timeframe),
      getPriceHistory("SPY", timeframe),
    ]).then(([histResult, spyResult]) => {
      if (histResult.status === "fulfilled") setHistory(histResult.value);
      if (spyResult.status === "fulfilled") setSpyHistory(spyResult.value);
    }).finally(() => setLoading(false));
  }, [selectedTicker, timeframe]);

  // Fetch correlation data for all watchlist tickers
  useEffect(() => {
    if (tickers.length < 2) return;
    Promise.allSettled(
      tickers.slice(0, 8).map((t) => getPriceHistory(t, "1Y").then((bars) => ({ ticker: t, closes: bars.map((b) => b.close) })))
    ).then((results) => {
      setCorrSeries(
        results
          .filter((r): r is PromiseFulfilledResult<{ ticker: string; closes: number[] }> => r.status === "fulfilled")
          .map((r) => r.value)
      );
    });
  }, [tickers.join(",")]);

  const closes = history.map((b) => b.close);
  const dates = history.map((b) => b.date);
  const returns = useMemo(() => dailyReturns(closes), [closes.join(",")]);
  const spyReturns = useMemo(() => dailyReturns(spyHistory.map((b) => b.close)), [spyHistory.join(",")]);

  const totalReturn = closes.length >= 2
    ? ((closes.at(-1)! - closes[0]) / closes[0]) * 100
    : null;
  const vol = returns.length >= 2 ? annualizedVolatility(returns) * 100 : null;
  const sharpe = returns.length >= 2 ? sharpeRatio(returns, 0.05) : null;
  const dd = closes.length >= 2 ? maxDrawdown(closes) : null;
  const betaVal = returns.length >= 2 && spyReturns.length >= 2 ? beta(returns, spyReturns) : null;

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header + selectors */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Analisi Quantitativa</h1>
        <div className="flex gap-2 items-center">
          <select
            value={selectedTicker}
            onChange={(e) => setSelectedTicker(e.target.value)}
            className="bg-card border border-border text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:border-accent"
          >
            {tickers.length === 0 && <option value="">—</option>}
            {tickers.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="flex gap-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  tf === timeframe ? "bg-accent text-white" : "text-muted hover:text-white"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tickers.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted">
          Aggiungi ticker alla watchlist per iniziare l&apos;analisi.
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse h-20" />
          ))}
        </div>
      )}

      {!loading && closes.length > 0 && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-5 gap-3">
            <QuantStatsCard
              label={`Rendimento ${timeframe}`}
              value={totalReturn !== null ? `${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(1)}%` : "—"}
              color={totalReturn !== null ? (totalReturn >= 0 ? "text-positive" : "text-negative") : "text-white"}
            />
            <QuantStatsCard
              label="Volatilità Ann."
              value={vol !== null ? `${vol.toFixed(1)}%` : "—"}
            />
            <QuantStatsCard
              label="Sharpe Ratio"
              value={sharpe !== null ? sharpe.toFixed(2) : "—"}
              color="text-purple-400"
            />
            <QuantStatsCard
              label="Max Drawdown"
              value={dd !== null ? `${(dd.value * 100).toFixed(1)}%` : "—"}
              color="text-negative"
              subtext={dd ? `${dd.durationDays}gg durata` : undefined}
            />
            <QuantStatsCard
              label="Beta vs SPY"
              value={betaVal !== null ? betaVal.toFixed(2) : "N/A"}
              color="text-blue-400"
            />
          </div>

          {/* Row 1: histogram + volatility */}
          <div className="grid grid-cols-2 gap-4">
            <ReturnsHistogram closes={closes} />
            <VolatilityChart closes={closes} dates={dates} />
          </div>

          {/* Row 2: drawdown + correlation */}
          <div className="grid grid-cols-2 gap-4">
            <DrawdownChart closes={closes} dates={dates} />
            <CorrelationHeatmap series={corrSeries} />
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify page renders**

Start dev server and visit http://localhost:3000/analisi — should show the page with selector and, if watchlist has tickers, the charts.

- [ ] **Step 4: Commit**

```bash
cd frontend && git add app/analisi/layout.tsx app/analisi/page.tsx
git commit -m "feat: /analisi page with stat cards, histogram, vol, drawdown, correlation heatmap"
```

---

## Task 7: EMA overlay on PriceChart

**Files:**
- Modify: `frontend/components/charts/PriceChart.tsx`
- Modify: `frontend/app/equity/[ticker]/page.tsx`

- [ ] **Step 1: Update PriceChart.tsx**

Replace the entire file:

```tsx
"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import type { PriceBar, Timeframe } from "@/types/openbb";

const TIMEFRAMES: Timeframe[] = ["1D", "1W", "1M", "3M", "6M", "1Y", "5Y"];

export interface EmaLine {
  period: number;
  values: number[];   // same length as data, NaN for initial periods
  color: string;
  enabled: boolean;
}

const EMA_COLORS: Record<number, string> = {
  9: "#f59e0b",
  21: "#a78bfa",
  50: "#3b82f6",
  200: "#6b7280",
};

interface Props {
  data: PriceBar[];
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  loading?: boolean;
  emaLines?: EmaLine[];
  onToggleEma?: (period: number) => void;
}

export default function PriceChart({
  data, timeframe, onTimeframeChange, loading,
  emaLines = [], onToggleEma,
}: Props) {
  const first = data[0]?.close ?? 0;
  const last = data.at(-1)?.close ?? 0;
  const positive = last >= first;
  const color = positive ? "#22c55e" : "#ef4444";

  const chartData = data.map((d, i) => {
    const point: Record<string, number | string> = {
      date: d.date.slice(0, 10),
      close: d.close,
    };
    for (const ema of emaLines) {
      const v = ema.values[i];
      if (ema.enabled && v !== undefined && !isNaN(v)) {
        point[`ema${ema.period}`] = v;
      }
    }
    return point;
  });

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex flex-wrap gap-1 mb-4 items-center">
        {/* Timeframe buttons */}
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => onTimeframeChange(tf)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              tf === timeframe
                ? "bg-accent text-white"
                : "text-muted hover:text-white"
            }`}
          >
            {tf}
          </button>
        ))}

        {/* EMA toggle pills */}
        {emaLines.length > 0 && (
          <div className="ml-auto flex gap-1">
            {emaLines.map((ema) => (
              <button
                key={ema.period}
                onClick={() => onToggleEma?.(ema.period)}
                style={{
                  borderColor: ema.color,
                  color: ema.enabled ? "#fff" : ema.color,
                  background: ema.enabled ? ema.color + "33" : "transparent",
                }}
                className="px-2 py-0.5 rounded text-xs border transition-colors"
              >
                EMA{ema.period}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-muted text-sm">
          Caricamento...
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={256}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickFormatter={(v) => v.slice(5)}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#6b7280" }}
              domain={["auto", "auto"]}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
            />
            <Tooltip
              contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }}
              labelStyle={{ color: "#e5e7eb" }}
              formatter={(v: number, name: string) => {
                if (name === "close") return [`$${v.toFixed(2)}`, "Chiusura"];
                return [`$${v.toFixed(2)}`, name.toUpperCase()];
              }}
            />
            <Line type="monotone" dataKey="close" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
            {emaLines
              .filter((e) => e.enabled)
              .map((ema) => (
                <Line
                  key={ema.period}
                  type="monotone"
                  dataKey={`ema${ema.period}`}
                  stroke={ema.color}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update equity page to compute EMAs**

In `frontend/app/equity/[ticker]/page.tsx`, add EMA computation and state. Add these imports:

```tsx
import { EMA } from "technicalindicators";
import type { EmaLine } from "@/components/charts/PriceChart";
```

Add EMA state inside the component (after existing state declarations):

```tsx
const [emaState, setEmaState] = useState<Record<number, boolean>>({
  9: false, 21: false, 50: false, 200: false,
});
```

Compute EMA lines from history (add after `const [error, setError] = useState...`):

```tsx
const emaLines: EmaLine[] = useMemo(() => {
  if (history.length === 0) return [];
  const closes = history.map((b) => b.close);
  return [
    { period: 9,   color: "#f59e0b", enabled: emaState[9] },
    { period: 21,  color: "#a78bfa", enabled: emaState[21] },
    { period: 50,  color: "#3b82f6", enabled: emaState[50] },
    { period: 200, color: "#6b7280", enabled: emaState[200] },
  ].map((cfg) => {
    if (closes.length < cfg.period) {
      return { ...cfg, values: closes.map(() => NaN) };
    }
    const raw = EMA.calculate({ values: closes, period: cfg.period });
    const padded = Array(closes.length - raw.length).fill(NaN).concat(raw);
    return { ...cfg, values: padded };
  });
}, [history, emaState]);
```

Add `import { useMemo } from "react"` if not already imported (it already is via `useState`). Actually add `useMemo` to the existing import:

```tsx
import { useState, useEffect, use, useMemo } from "react";
```

Update the PriceChart render to pass EMA props:

```tsx
<PriceChart
  data={history}
  timeframe={timeframe}
  onTimeframeChange={(tf) => setTimeframe(tf)}
  loading={chartLoading}
  emaLines={emaLines}
  onToggleEma={(period) => setEmaState((prev) => ({ ...prev, [period]: !prev[period] }))}
/>
```

- [ ] **Step 3: Verify in browser**

Visit `/equity/AAPL` — should see EMA9/21/50/200 pills in the chart toolbar. Clicking a pill should toggle the overlay line.

- [ ] **Step 4: Commit**

```bash
cd frontend && git add components/charts/PriceChart.tsx app/equity/[ticker]/page.tsx
git commit -m "feat: EMA overlay on PriceChart with toggle buttons (9/21/50/200)"
```

---

## Task 8: Extended indicators in SignalsPanel

**Files:**
- Modify: `frontend/components/equity/SignalsPanel.tsx`

- [ ] **Step 1: Replace SignalsPanel.tsx**

```tsx
"use client";

import { useMemo } from "react";
import { RSI, MACD, BollingerBands, ATR, Stochastic, ADX, OBV, WilliamsR } from "technicalindicators";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import IndicatorChart from "@/components/charts/IndicatorChart";
import type { PriceBar } from "@/types/openbb";

interface Props {
  data: PriceBar[];
}

function interpretRsi(value: number): { label: string; color: string } {
  if (value >= 70) return { label: "Ipercomprato", color: "text-negative" };
  if (value <= 30) return { label: "Ipervenduto", color: "text-positive" };
  return { label: "Neutrale", color: "text-muted" };
}

function interpretMacd(hist: number): { label: string; color: string } {
  if (hist > 0) return { label: "Rialzista", color: "text-positive" };
  if (hist < 0) return { label: "Ribassista", color: "text-negative" };
  return { label: "Neutrale", color: "text-muted" };
}

function interpretBB(price: number, upper: number, lower: number): { label: string; color: string } {
  if (price >= upper) return { label: "Sopra banda sup.", color: "text-negative" };
  if (price <= lower) return { label: "Sotto banda inf.", color: "text-positive" };
  return { label: "Dentro le bande", color: "text-muted" };
}

export default function SignalsPanel({ data }: Props) {
  const closes = data.map((d) => d.close);
  const highs = data.map((d) => d.high);
  const lows = data.map((d) => d.low);
  const volumes = data.map((d) => d.volume ?? 0);
  const dates = data.map((d) => d.date.slice(0, 10));

  const closesKey = closes.join(",");
  const hlKey = highs.join(",");

  const rsiValues = useMemo(() => {
    if (closes.length < 14) return [];
    return RSI.calculate({ values: closes, period: 14 });
  }, [closesKey]);

  const macdValues = useMemo(() => {
    if (closes.length < 26) return [];
    return MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false });
  }, [closesKey]);

  const bbValues = useMemo(() => {
    if (closes.length < 20) return [];
    return BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });
  }, [closesKey]);

  const atrValues = useMemo(() => {
    if (data.length < 14) return [];
    return ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });
  }, [hlKey]);

  const stochValues = useMemo(() => {
    if (data.length < 14) return [];
    return Stochastic.calculate({ high: highs, low: lows, close: closes, period: 14, signalPeriod: 3 });
  }, [hlKey]);

  const adxValues = useMemo(() => {
    if (data.length < 14) return [];
    return ADX.calculate({ high: highs, low: lows, close: closes, period: 14 });
  }, [hlKey]);

  const obvValues = useMemo(() => {
    if (data.length < 2) return [];
    return OBV.calculate({ close: closes, volume: volumes });
  }, [closesKey]);

  const wrValues = useMemo(() => {
    if (data.length < 14) return [];
    return WilliamsR.calculate({ high: highs, low: lows, close: closes, period: 14 });
  }, [hlKey]);

  // Align to date arrays
  function align<T>(values: T[], total: number): { date: string; value: T }[] {
    return values.map((v, i) => ({ date: dates[total - values.length + i] ?? "", value: v }));
  }

  const rsiData = align(rsiValues, dates.length).map(({ date, value }) => ({ date, value: value as number }));
  const macdHistData = align(macdValues, dates.length).map(({ date, value }) => ({ date, value: (value as { histogram?: number }).histogram ?? 0 }));
  const atrData = align(atrValues, dates.length).map(({ date, value }) => ({ date, value: value as number }));
  const adxData = align(adxValues, dates.length).map(({ date, value }) => ({ date, value: (value as { adx: number }).adx }));
  const obvData = align(obvValues, dates.length).map(({ date, value }) => ({ date, value: value as number }));
  const wrData = align(wrValues, dates.length).map(({ date, value }) => ({ date, value: value as number }));

  const stochChartData = stochValues.map((v, i) => ({
    date: dates[dates.length - stochValues.length + i] ?? "",
    k: v.k,
    d: v.d,
  }));

  const bbChartData = bbValues.map((v, i) => ({
    date: dates[dates.length - bbValues.length + i],
    upper: v.upper,
    middle: v.middle,
    lower: v.lower,
    price: closes[closes.length - bbValues.length + i],
  }));

  const lastRsi = rsiValues.at(-1);
  const lastMacdHist = macdValues.at(-1)?.histogram ?? 0;
  const lastBB = bbValues.at(-1);
  const lastPrice = closes.at(-1) ?? 0;
  const lastAtr = atrValues.at(-1);
  const lastStoch = stochValues.at(-1);

  const rsiSignal = lastRsi !== undefined ? interpretRsi(lastRsi) : null;
  const macdSignal = interpretMacd(lastMacdHist);
  const bbSignal = lastBB ? interpretBB(lastPrice, lastBB.upper, lastBB.lower) : null;

  return (
    <div className="space-y-4">
      {/* Riepilogo segnali — 5 colonne */}
      <div className="bg-card border border-border rounded-xl p-4 grid grid-cols-5 gap-4">
        <div>
          <span className="text-muted text-xs uppercase">RSI (14)</span>
          <p className="text-white font-semibold">{lastRsi?.toFixed(1) ?? "—"}</p>
          {rsiSignal && <p className={`text-sm ${rsiSignal.color}`}>{rsiSignal.label}</p>}
        </div>
        <div>
          <span className="text-muted text-xs uppercase">MACD</span>
          <p className="text-white font-semibold">{lastMacdHist.toFixed(3)}</p>
          <p className={`text-sm ${macdSignal.color}`}>{macdSignal.label}</p>
        </div>
        <div>
          <span className="text-muted text-xs uppercase">Bollinger (20)</span>
          <p className="text-white font-semibold">{lastBB ? `$${lastBB.upper.toFixed(1)}` : "—"}</p>
          {bbSignal && <p className={`text-sm ${bbSignal.color}`}>{bbSignal.label}</p>}
        </div>
        <div>
          <span className="text-muted text-xs uppercase">ATR (14)</span>
          <p className="text-white font-semibold">{lastAtr ? `$${lastAtr.toFixed(2)}` : "—"}</p>
          <p className="text-muted text-sm">Volatilità</p>
        </div>
        <div>
          <span className="text-muted text-xs uppercase">Stochastic K</span>
          <p className="text-white font-semibold">{lastStoch ? lastStoch.k.toFixed(1) : "—"}</p>
          <p className={`text-sm ${lastStoch ? (lastStoch.k >= 80 ? "text-negative" : lastStoch.k <= 20 ? "text-positive" : "text-muted") : "text-muted"}`}>
            {lastStoch ? (lastStoch.k >= 80 ? "Ipercomprato" : lastStoch.k <= 20 ? "Ipervenduto" : "Neutrale") : "—"}
          </p>
        </div>
      </div>

      {/* RSI */}
      {rsiData.length > 0 && (
        <IndicatorChart data={rsiData} label="RSI (14)" color="#a78bfa" referenceLines={[70, 30]} domain={[0, 100]} />
      )}

      {/* MACD Histogram */}
      {macdHistData.length > 0 && (
        <IndicatorChart data={macdHistData} label="MACD Histogram" color="#3b82f6" referenceLines={[0]} />
      )}

      {/* Bollinger Bands */}
      {bbChartData.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <span className="text-muted text-xs uppercase tracking-wide">Bollinger Bands (20, 2σ)</span>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={bbChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} tickFormatter={(v) => v.slice(5)} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} domain={["auto", "auto"]} tickFormatter={(v) => `$${v.toFixed(0)}`} />
              <Tooltip contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }} formatter={(v: number, name: string) => [`$${v.toFixed(2)}`, name]} />
              <Line type="monotone" dataKey="upper" stroke="#ef4444" strokeWidth={1} dot={false} isAnimationActive={false} name="Upper" />
              <Line type="monotone" dataKey="middle" stroke="#6b7280" strokeWidth={1} strokeDasharray="4 4" dot={false} isAnimationActive={false} name="SMA20" />
              <Line type="monotone" dataKey="lower" stroke="#22c55e" strokeWidth={1} dot={false} isAnimationActive={false} name="Lower" />
              <Line type="monotone" dataKey="price" stroke="#ffffff" strokeWidth={1.5} dot={false} isAnimationActive={false} name="Prezzo" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ATR */}
      {atrData.length > 0 && (
        <IndicatorChart data={atrData} label="ATR (14) — Volatilità in $" color="#22c55e" />
      )}

      {/* Stochastic K/D */}
      {stochChartData.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <span className="text-muted text-xs uppercase tracking-wide">Stochastic (14, 3)</span>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={stochChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} tickFormatter={(v) => v.slice(5)} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }} formatter={(v: number, name: string) => [v.toFixed(1), name]} />
              <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="3 3" />
              <ReferenceLine y={20} stroke="#22c55e" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="k" stroke="#a78bfa" strokeWidth={1.5} dot={false} isAnimationActive={false} name="%K" />
              <Line type="monotone" dataKey="d" stroke="#f59e0b" strokeWidth={1.5} dot={false} isAnimationActive={false} name="%D" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ADX */}
      {adxData.length > 0 && (
        <IndicatorChart data={adxData} label="ADX (14) — Forza del trend" color="#f59e0b" referenceLines={[25]} domain={[0, 100]} />
      )}

      {/* OBV */}
      {obvData.length > 0 && (
        <IndicatorChart data={obvData} label="OBV — On-Balance Volume" color="#3b82f6" />
      )}

      {/* Williams %R */}
      {wrData.length > 0 && (
        <IndicatorChart data={wrData} label="Williams %R (14)" color="#ec4899" referenceLines={[-20, -80]} domain={[-100, 0]} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify no type errors**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add components/equity/SignalsPanel.tsx
git commit -m "feat: extend SignalsPanel with ATR, Stochastic, ADX, OBV, Williams %R"
```

---

## Task 9: Run all tests

- [ ] **Step 1: Run full test suite**

```bash
cd frontend && npm test 2>&1 | tail -40
```

Expected: all tests pass (quant tests + portfolio tests + openbb tests).

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Final commit if any fixes needed**

```bash
cd frontend && git add -p && git commit -m "fix: address any TS/test issues from quant feature"
```
