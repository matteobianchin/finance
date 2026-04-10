# Dashboard Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add candlestick+volume chart, multi-ticker comparison, AI analysis via Claude API, portfolio historical value chart, stock screener, earnings calendar, and UX quick wins (keyboard shortcuts, persistent tab preference, export chart to PNG).

**Architecture:** Candlestick uses a custom SVG component (no new chart library). AI analysis uses a Next.js API route with the Anthropic SDK and streaming. Portfolio history is computed by replaying historical prices against holdings. Screener and earnings use existing OpenBB endpoints. UX features use browser APIs only.

**Tech Stack:** Next.js 14, React, Recharts, `@anthropic-ai/sdk` (new), SVG for candlestick — no other new packages.

---

## File Map

**New files:**
- `frontend/components/charts/CandlestickChart.tsx` — custom SVG OHLC + volume chart
- `frontend/components/charts/ComparisonChart.tsx` — multi-ticker normalized return chart
- `frontend/components/equity/AIAnalysisPanel.tsx` — replaces AIAnalysisButton, shows streaming response
- `frontend/app/api/analyze/route.ts` — Next.js API route calling Claude
- `frontend/components/portfolio/PortfolioHistoryChart.tsx` — cumulative portfolio value over time
- `frontend/app/screener/layout.tsx` + `page.tsx` — stock screener
- `frontend/app/earnings/layout.tsx` + `page.tsx` — earnings calendar
- `frontend/lib/screener.ts` — screener filter/sort logic
- `frontend/hooks/useKeyboardShortcut.ts` — keyboard shortcut hook

**Modified files:**
- `frontend/app/equity/[ticker]/page.tsx` — add chart toggle (line/candlestick), add comparison tab
- `frontend/components/equity/AIAnalysisButton.tsx` → replaced by AIAnalysisPanel
- `frontend/app/portfolio/page.tsx` — add historical value chart tab
- `frontend/components/layout/Sidebar.tsx` — add Screener + Earnings nav entries
- `frontend/app/layout.tsx` — add global keyboard shortcut listener

---

## Task 1: Install @anthropic-ai/sdk

- [ ] **Step 1: Install the SDK**

```bash
cd frontend && npm install @anthropic-ai/sdk
```

Expected output: added 1 package.

- [ ] **Step 2: Add env var to .env.local**

Create `frontend/.env.local` if it doesn't exist, add:

```
ANTHROPIC_API_KEY=your_key_here
```

Note: this file is gitignored. The API route will check for this key.

- [ ] **Step 3: Commit package.json / package-lock.json**

```bash
cd frontend && git add package.json package-lock.json
git commit -m "deps: add @anthropic-ai/sdk for AI analysis feature"
```

---

## Task 2: AI Analysis API route + panel

**Files:**
- Create: `frontend/app/api/analyze/route.ts`
- Create: `frontend/components/equity/AIAnalysisPanel.tsx`
- Modify: `frontend/app/equity/[ticker]/page.tsx` (swap AIAnalysisButton → AIAnalysisPanel)

- [ ] **Step 1: Create the API route**

Create `frontend/app/api/analyze/route.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY non configurata" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.json();
  const { ticker, price, change, rsi, macd, atrVal, sharpe, maxDD, description } = body;

  const client = new Anthropic({ apiKey });

  const prompt = `Sei un analista finanziario quantitativo. Analizza il seguente titolo e fornisci un'analisi concisa in italiano (max 200 parole).

Titolo: ${ticker}
Prezzo attuale: $${price}
Variazione giornaliera: ${change}%
RSI (14): ${rsi ?? "N/A"}
MACD histogram: ${macd ?? "N/A"}
ATR (14): ${atrVal ?? "N/A"}
Sharpe Ratio (1Y): ${sharpe ?? "N/A"}
Max Drawdown (1Y): ${maxDD ?? "N/A"}
${description ? `Contesto aggiuntivo: ${description}` : ""}

Fornisci:
1. Sentiment tecnico attuale (1-2 frasi)
2. Livelli chiave da monitorare
3. Rischi principali
4. Conclusione breve

Sii diretto e professionale.`;

  const stream = await client.messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          controller.enqueue(new TextEncoder().encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
```

- [ ] **Step 2: Create AIAnalysisPanel.tsx**

Create `frontend/components/equity/AIAnalysisPanel.tsx`:

```tsx
"use client";

import { useState } from "react";
import { BrainCircuit, X, Loader2 } from "lucide-react";

interface Props {
  ticker: string;
  price: number;
  change: number;
  rsi?: number;
  macd?: number;
  atrVal?: number;
}

export default function AIAnalysisPanel({ ticker, price, change, rsi, macd, atrVal }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  async function run() {
    setOpen(true);
    setLoading(true);
    setText("");
    setError("");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, price: price.toFixed(2), change: change.toFixed(2), rsi, macd, atrVal }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setText((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={run}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border text-white hover:border-accent transition-colors text-sm"
      >
        <BrainCircuit size={16} className="text-accent" />
        Analisi AI
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setOpen(false)}>
          <div
            className="bg-card border border-border rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <BrainCircuit size={18} className="text-accent" />
                <span className="text-white font-semibold">Analisi AI — {ticker}</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-white">
                <X size={18} />
              </button>
            </div>

            {loading && !text && (
              <div className="flex items-center gap-2 text-muted">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Analisi in corso...</span>
              </div>
            )}

            {error && (
              <p className="text-negative text-sm">Errore: {error}</p>
            )}

            {text && (
              <div className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap">
                {text}
                {loading && <span className="animate-pulse">▊</span>}
              </div>
            )}

            <p className="text-muted text-xs mt-4 border-t border-border pt-3">
              Powered by Claude AI · Solo a scopo informativo, non costituisce consulenza finanziaria.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update equity page to use AIAnalysisPanel**

In `frontend/app/equity/[ticker]/page.tsx`:

Replace the import:
```tsx
import AIAnalysisButton from "@/components/equity/AIAnalysisButton";
```
with:
```tsx
import AIAnalysisPanel from "@/components/equity/AIAnalysisPanel";
```

Replace the render:
```tsx
<AIAnalysisButton />
```
with:
```tsx
<AIAnalysisPanel
  ticker={symbol}
  price={quote?.price ?? 0}
  change={quote?.day_change_percent ?? 0}
/>
```

- [ ] **Step 4: Test the API route**

With dev server running and `ANTHROPIC_API_KEY` set, visit `/equity/AAPL`, click "Analisi AI". Should stream text into the modal.

- [ ] **Step 5: Commit**

```bash
cd frontend && git add app/api/analyze/route.ts components/equity/AIAnalysisPanel.tsx app/equity/\[ticker\]/page.tsx
git commit -m "feat: AI analysis panel with streaming Claude response"
```

---

## Task 3: Candlestick + Volume chart

**Files:**
- Create: `frontend/components/charts/CandlestickChart.tsx`
- Modify: `frontend/app/equity/[ticker]/page.tsx` — add toggle between line/candlestick

- [ ] **Step 1: Create CandlestickChart.tsx**

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import type { PriceBar, Timeframe } from "@/types/openbb";

const TIMEFRAMES: Timeframe[] = ["1D", "1W", "1M", "3M", "6M", "1Y", "5Y"];

const PADDING = { top: 10, right: 55, bottom: 40, left: 10 };
const VOLUME_HEIGHT_RATIO = 0.2; // bottom 20% for volume

interface Props {
  data: PriceBar[];
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  loading?: boolean;
}

export default function CandlestickChart({ data, timeframe, onTimeframeChange, loading }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const totalHeight = 300;
  const priceHeight = totalHeight * (1 - VOLUME_HEIGHT_RATIO);
  const volHeight = totalHeight * VOLUME_HEIGHT_RATIO;

  const chartW = width - PADDING.left - PADDING.right;
  const priceH = priceHeight - PADDING.top - 8;
  const volH = volHeight - 8;

  const candles = data.slice(-Math.min(data.length, 150)); // cap at 150 for clarity
  const n = candles.length;

  // Price scale
  const allPrices = candles.flatMap((d) => [d.high, d.low]);
  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const priceRange = maxP - minP || 1;

  function yPrice(price: number): number {
    return PADDING.top + ((maxP - price) / priceRange) * priceH;
  }

  // Volume scale
  const maxVol = Math.max(...candles.map((d) => d.volume ?? 0), 1);
  function yVol(vol: number): number {
    return priceHeight + volH - (vol / maxVol) * volH;
  }

  // X scale
  const candleW = Math.max(2, chartW / n - 1);
  function xCenter(i: number): number {
    return PADDING.left + (i + 0.5) * (chartW / n);
  }

  // Y-axis ticks (5 ticks)
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const price = minP + (priceRange * i) / 4;
    return { price, y: yPrice(price) };
  });

  // X-axis ticks (show ~6 evenly)
  const xTicks: { date: string; x: number }[] = [];
  const step = Math.max(1, Math.floor(n / 6));
  for (let i = 0; i < n; i += step) {
    xTicks.push({ date: candles[i].date.slice(5, 10), x: xCenter(i) });
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex gap-1 mb-4 flex-wrap">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => onTimeframeChange(tf)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              tf === timeframe ? "bg-accent text-white" : "text-muted hover:text-white"
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-64 bg-border rounded animate-pulse" />
      ) : (
        <div ref={containerRef} className="w-full">
          <svg width="100%" height={totalHeight} viewBox={`0 0 ${width} ${totalHeight}`}>
            {/* Grid lines */}
            {yTicks.map(({ y }, i) => (
              <line key={i} x1={PADDING.left} y1={y} x2={width - PADDING.right} y2={y} stroke="#2a2d3a" strokeWidth={1} />
            ))}

            {/* Y-axis labels */}
            {yTicks.map(({ price, y }, i) => (
              <text key={i} x={width - PADDING.right + 4} y={y + 3} fill="#6b7280" fontSize={10} textAnchor="start">
                ${price.toFixed(0)}
              </text>
            ))}

            {/* X-axis labels */}
            {xTicks.map(({ date, x }, i) => (
              <text key={i} x={x} y={totalHeight - 4} fill="#6b7280" fontSize={10} textAnchor="middle">
                {date}
              </text>
            ))}

            {/* Candles */}
            {candles.map((bar, i) => {
              const isGreen = bar.close >= bar.open;
              const color = isGreen ? "#22c55e" : "#ef4444";
              const bodyTop = yPrice(Math.max(bar.open, bar.close));
              const bodyBot = yPrice(Math.min(bar.open, bar.close));
              const bodyH = Math.max(1, bodyBot - bodyTop);
              const cx = xCenter(i);

              return (
                <g key={bar.date}>
                  {/* Wick */}
                  <line x1={cx} y1={yPrice(bar.high)} x2={cx} y2={yPrice(bar.low)} stroke={color} strokeWidth={1} />
                  {/* Body */}
                  <rect
                    x={cx - candleW / 2}
                    y={bodyTop}
                    width={candleW}
                    height={bodyH}
                    fill={isGreen ? color : color}
                    stroke={color}
                    strokeWidth={0.5}
                    fillOpacity={isGreen ? 0.8 : 1}
                  />
                </g>
              );
            })}

            {/* Volume separator line */}
            <line x1={PADDING.left} y1={priceHeight} x2={width - PADDING.right} y2={priceHeight} stroke="#2a2d3a" strokeWidth={1} />

            {/* Volume bars */}
            {candles.map((bar, i) => {
              const isGreen = bar.close >= bar.open;
              const color = isGreen ? "#22c55e" : "#ef4444";
              const vol = bar.volume ?? 0;
              const barH = Math.max(1, yVol(0) - yVol(vol));
              return (
                <rect
                  key={bar.date + "v"}
                  x={xCenter(i) - candleW / 2}
                  y={priceHeight + volH - barH}
                  width={candleW}
                  height={barH}
                  fill={color}
                  fillOpacity={0.5}
                />
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add chart toggle to equity page**

In `frontend/app/equity/[ticker]/page.tsx`, add:

```tsx
import CandlestickChart from "@/components/charts/CandlestickChart";
```

Add state:
```tsx
const [chartMode, setChartMode] = useState<"line" | "candle">("line");
```

Replace the chart section (the ternary that renders PriceChart) with:

```tsx
{chartLoading && !history.length ? (
  <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
    <div className="flex gap-1 mb-4">
      {["1D","1W","1M","3M","6M","1Y","5Y"].map((tf) => (
        <div key={tf} className="h-6 w-8 bg-border rounded" />
      ))}
    </div>
    <div className="h-64 bg-border rounded" />
  </div>
) : (
  <div>
    {/* Chart mode toggle */}
    <div className="flex justify-end gap-1 mb-2">
      {(["line", "candle"] as const).map((mode) => (
        <button
          key={mode}
          onClick={() => setChartMode(mode)}
          className={`px-3 py-1 rounded text-xs transition-colors ${
            chartMode === mode ? "bg-accent text-white" : "text-muted hover:text-white bg-card border border-border"
          }`}
        >
          {mode === "line" ? "Linea" : "Candele"}
        </button>
      ))}
    </div>
    {chartMode === "line" ? (
      <PriceChart
        data={history}
        timeframe={timeframe}
        onTimeframeChange={(tf) => setTimeframe(tf)}
        loading={chartLoading}
        emaLines={emaLines}
        onToggleEma={(period) => setEmaState((prev) => ({ ...prev, [period]: !prev[period] }))}
      />
    ) : (
      <CandlestickChart
        data={history}
        timeframe={timeframe}
        onTimeframeChange={(tf) => setTimeframe(tf)}
        loading={chartLoading}
      />
    )}
  </div>
)}
```

- [ ] **Step 3: Verify candles render correctly**

Visit `/equity/AAPL`, toggle to "Candele". Should show green/red candles with wicks and volume bars below.

- [ ] **Step 4: Commit**

```bash
cd frontend && git add components/charts/CandlestickChart.tsx app/equity/\[ticker\]/page.tsx
git commit -m "feat: candlestick + volume chart with line/candle toggle"
```

---

## Task 4: Multi-ticker comparison chart

**Files:**
- Create: `frontend/components/charts/ComparisonChart.tsx`
- Modify: `frontend/app/equity/[ticker]/page.tsx` — add "confronto" tab

- [ ] **Step 1: Create ComparisonChart.tsx**

```tsx
"use client";

import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { getPriceHistory } from "@/lib/openbb";
import type { Timeframe } from "@/types/openbb";

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#a78bfa", "#ec4899", "#ef4444", "#14b8a6", "#f97316"];

interface Props {
  primaryTicker: string;
  watchlist: string[];
  timeframe: Timeframe;
}

export default function ComparisonChart({ primaryTicker, watchlist, timeframe }: Props) {
  const [chartData, setChartData] = useState<Record<string, number | string>[]>([]);
  const [activeTickers, setActiveTickers] = useState<string[]>([primaryTicker]);
  const [loading, setLoading] = useState(false);

  const candidates = [primaryTicker, ...watchlist.filter((t) => t !== primaryTicker)].slice(0, 8);

  useEffect(() => {
    if (activeTickers.length === 0) return;
    setLoading(true);

    Promise.allSettled(
      activeTickers.map((t) => getPriceHistory(t, timeframe).then((bars) => ({ ticker: t, bars })))
    ).then((results) => {
      const seriesMap: Record<string, Record<string, number>> = {};

      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        const { ticker, bars } = result.value;
        const base = bars[0]?.close ?? 1;
        for (const bar of bars) {
          const date = bar.date.slice(0, 10);
          if (!seriesMap[date]) seriesMap[date] = {};
          seriesMap[date][ticker] = parseFloat((((bar.close - base) / base) * 100).toFixed(2));
        }
      }

      const sorted = Object.entries(seriesMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, values]) => ({ date, ...values }));

      setChartData(sorted);
    }).finally(() => setLoading(false));
  }, [activeTickers.join(","), timeframe]);

  function toggle(ticker: string) {
    setActiveTickers((prev) =>
      prev.includes(ticker) ? prev.filter((t) => t !== ticker) : [...prev, ticker]
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <p className="text-muted text-xs uppercase tracking-wide">Confronto Performance (base = 0%)</p>

      {/* Ticker toggles */}
      <div className="flex flex-wrap gap-2">
        {candidates.map((t, i) => {
          const active = activeTickers.includes(t);
          const color = COLORS[i % COLORS.length];
          return (
            <button
              key={t}
              onClick={() => toggle(t)}
              style={{ borderColor: color, color: active ? "#fff" : color, background: active ? color + "33" : "transparent" }}
              className="px-2 py-0.5 rounded text-xs border transition-colors font-medium"
            >
              {t}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="h-48 bg-border rounded animate-pulse" />
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} tickFormatter={(v) => v.slice(5)} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }}
              formatter={(v: number, name: string) => [`${v.toFixed(2)}%`, name]}
            />
            {activeTickers.map((ticker, i) => (
              <Line
                key={ticker}
                type="monotone"
                dataKey={ticker}
                stroke={COLORS[candidates.indexOf(ticker) % COLORS.length]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add "confronto" tab to equity page**

In `frontend/app/equity/[ticker]/page.tsx`:

```tsx
import ComparisonChart from "@/components/charts/ComparisonChart";
import { useWatchlist } from "@/components/overview/WatchlistManager";
```

Add inside component:
```tsx
const { tickers: watchlist } = useWatchlist();
```

Add "confronto" to the tabs array and render:
```tsx
{(["indicatori", "fondamentali", "news", "confronto"] as const).map((tab) => (
  ...
))}
```

In the tab content section, add:
```tsx
: activeTab === "confronto" ? (
  <ComparisonChart primaryTicker={symbol} watchlist={watchlist} timeframe={timeframe} />
)
```

Update the type of `activeTab`:
```tsx
const [activeTab, setActiveTab] = useState<"indicatori" | "fondamentali" | "news" | "confronto">("indicatori");
```

- [ ] **Step 3: Commit**

```bash
cd frontend && git add components/charts/ComparisonChart.tsx app/equity/\[ticker\]/page.tsx
git commit -m "feat: multi-ticker comparison chart + confronto tab"
```

---

## Task 5: Portfolio historical value chart

**Files:**
- Create: `frontend/components/portfolio/PortfolioHistoryChart.tsx`
- Modify: `frontend/app/portfolio/page.tsx` — add history tab

- [ ] **Step 1: Create PortfolioHistoryChart.tsx**

```tsx
"use client";

import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getPriceHistory } from "@/lib/openbb";
import type { PortfolioRow } from "@/types/openbb";

interface Props {
  rows: PortfolioRow[];
}

export default function PortfolioHistoryChart({ rows }: Props) {
  const [data, setData] = useState<{ date: string; value: number }[]>([]);
  const [costBasis, setCostBasis] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (rows.length === 0) return;

    // Aggregate rows by ticker (weighted avg buy_price)
    const tickerMap = new Map<string, { quantity: number; totalCost: number; buy_date: string }>();
    for (const row of rows) {
      const ex = tickerMap.get(row.ticker);
      if (ex) {
        ex.totalCost += row.quantity * row.buy_price;
        ex.quantity += row.quantity;
      } else {
        tickerMap.set(row.ticker, {
          quantity: row.quantity,
          totalCost: row.quantity * row.buy_price,
          buy_date: row.buy_date,
        });
      }
    }

    const totalCost = Array.from(tickerMap.values()).reduce((s, v) => s + v.totalCost, 0);
    setCostBasis(totalCost);

    setLoading(true);
    Promise.allSettled(
      Array.from(tickerMap.entries()).map(([ticker, { quantity }]) =>
        getPriceHistory(ticker, "1Y").then((bars) => ({ ticker, quantity, bars }))
      )
    ).then((results) => {
      // Build date → value map
      const dateMap = new Map<string, number>();
      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        const { quantity, bars } = result.value;
        for (const bar of bars) {
          const date = bar.date.slice(0, 10);
          dateMap.set(date, (dateMap.get(date) ?? 0) + quantity * bar.close);
        }
      }
      const sorted = Array.from(dateMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, value]) => ({ date, value: parseFloat(value.toFixed(2)) }));
      setData(sorted);
    }).finally(() => setLoading(false));
  }, [rows.map((r) => r.ticker + r.quantity + r.buy_price).join(",")]);

  const current = data.at(-1)?.value ?? 0;
  const gain = current - costBasis;
  const gainPct = costBasis > 0 ? (gain / costBasis) * 100 : 0;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex justify-between items-start">
        <p className="text-muted text-xs uppercase tracking-wide">Valore Portafoglio (1Y)</p>
        {current > 0 && (
          <div className="text-right">
            <p className="text-white font-semibold">${current.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
            <p className={`text-sm ${gain >= 0 ? "text-positive" : "text-negative"}`}>
              {gain >= 0 ? "+" : ""}{gain.toFixed(0)} ({gainPct.toFixed(1)}%)
            </p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-48 bg-border rounded animate-pulse" />
      ) : data.length > 0 ? (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} tickFormatter={(v) => v.slice(5)} interval="preserveStartEnd" />
            <YAxis
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }}
              formatter={(v: number) => [`$${v.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "Valore"]}
            />
            <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#portfolioGrad)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-muted text-sm">Nessun dato disponibile.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add history tab to portfolio page**

Read `frontend/app/portfolio/page.tsx` first, then add a "Storico" tab that renders `<PortfolioHistoryChart rows={rows} />` where `rows` is the parsed CSV data already in state.

Import:
```tsx
import PortfolioHistoryChart from "@/components/portfolio/PortfolioHistoryChart";
```

Add "storico" to the existing tab state type and render in the tab content area (the exact implementation depends on current tab structure — add alongside existing "P&L" / "Allocazione" tabs).

- [ ] **Step 3: Commit**

```bash
cd frontend && git add components/portfolio/PortfolioHistoryChart.tsx app/portfolio/page.tsx
git commit -m "feat: portfolio historical value chart (1Y)"
```

---

## Task 6: Stock Screener

**Files:**
- Create: `frontend/lib/screener.ts`
- Create: `frontend/app/screener/layout.tsx`
- Create: `frontend/app/screener/page.tsx`
- Modify: `frontend/components/layout/Sidebar.tsx`

- [ ] **Step 1: Create lib/screener.ts**

```ts
export interface ScreenerRow {
  ticker: string;
  price: number;
  change1d: number;
  volume: number;
  marketCap?: number;
  pe?: number;
  return1m?: number;
  rsi?: number;
}

export type SortKey = keyof ScreenerRow;
export type SortDir = "asc" | "desc";

export function filterRows(
  rows: ScreenerRow[],
  filters: {
    minRsi?: number;
    maxRsi?: number;
    minReturn1m?: number;
    maxReturn1m?: number;
    minPe?: number;
    maxPe?: number;
    search?: string;
  }
): ScreenerRow[] {
  return rows.filter((r) => {
    if (filters.minRsi !== undefined && (r.rsi ?? 0) < filters.minRsi) return false;
    if (filters.maxRsi !== undefined && (r.rsi ?? 100) > filters.maxRsi) return false;
    if (filters.minReturn1m !== undefined && (r.return1m ?? -Infinity) < filters.minReturn1m) return false;
    if (filters.maxReturn1m !== undefined && (r.return1m ?? Infinity) > filters.maxReturn1m) return false;
    if (filters.minPe !== undefined && (r.pe ?? 0) < filters.minPe) return false;
    if (filters.maxPe !== undefined && (r.pe ?? Infinity) > filters.maxPe) return false;
    if (filters.search && !r.ticker.includes(filters.search.toUpperCase())) return false;
    return true;
  });
}

export function sortRows(rows: ScreenerRow[], key: SortKey, dir: SortDir): ScreenerRow[] {
  return [...rows].sort((a, b) => {
    const av = a[key] ?? 0;
    const bv = b[key] ?? 0;
    return dir === "asc" ? (av > bv ? 1 : -1) : av < bv ? 1 : -1;
  });
}
```

- [ ] **Step 2: Create screener/layout.tsx**

```tsx
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Screener | OpenBB" };
export default function ScreenerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 3: Create screener/page.tsx**

```tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getPriceHistory, getQuote } from "@/lib/openbb";
import { RSI } from "technicalindicators";
import { filterRows, sortRows } from "@/lib/screener";
import { useWatchlist } from "@/components/overview/WatchlistManager";
import type { ScreenerRow, SortKey, SortDir } from "@/lib/screener";

// Fixed universe + watchlist
const BASE_UNIVERSE = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK-B", "JPM", "JNJ",
                       "V", "PG", "UNH", "HD", "MA", "XOM", "LLY", "ABBV", "MRK", "PEP"];

export default function ScreenerPage() {
  const router = useRouter();
  const { tickers: watchlist } = useWatchlist();
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("change1d");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [minRsi, setMinRsi] = useState("");
  const [maxRsi, setMaxRsi] = useState("");
  const [minRet, setMinRet] = useState("");
  const [maxRet, setMaxRet] = useState("");

  const universe = Array.from(new Set([...BASE_UNIVERSE, ...watchlist]));

  useEffect(() => {
    setLoading(true);
    Promise.allSettled(
      universe.map(async (ticker) => {
        const [quote, hist1m] = await Promise.all([
          getQuote(ticker).catch(() => null),
          getPriceHistory(ticker, "1M").catch(() => []),
        ]);
        if (!quote) return null;

        const closes = hist1m.map((b) => b.close);
        const rsiVals = closes.length >= 14 ? RSI.calculate({ values: closes, period: 14 }) : [];
        const rsi = rsiVals.at(-1);
        const return1m = closes.length >= 2
          ? ((closes.at(-1)! - closes[0]) / closes[0]) * 100
          : undefined;

        return {
          ticker,
          price: quote.price,
          change1d: quote.day_change_percent,
          volume: quote.volume ?? 0,
          marketCap: quote.market_cap,
          pe: quote.pe_ratio,
          return1m,
          rsi,
        } satisfies ScreenerRow;
      })
    ).then((results) => {
      setRows(
        results
          .filter((r): r is PromiseFulfilledResult<ScreenerRow> => r.status === "fulfilled" && r.value !== null)
          .map((r) => r.value as ScreenerRow)
      );
    }).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const f = filterRows(rows, {
      search,
      minRsi: minRsi ? parseFloat(minRsi) : undefined,
      maxRsi: maxRsi ? parseFloat(maxRsi) : undefined,
      minReturn1m: minRet ? parseFloat(minRet) : undefined,
      maxReturn1m: maxRet ? parseFloat(maxRet) : undefined,
    });
    return sortRows(f, sortKey, sortDir);
  }, [rows, search, minRsi, maxRsi, minRet, maxRet, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const th = "text-muted text-xs uppercase px-3 py-2 text-right cursor-pointer hover:text-white select-none";
  const td = "px-3 py-2 text-sm text-right";

  return (
    <div className="space-y-4 max-w-5xl">
      <h1 className="text-2xl font-bold text-white">Screener</h1>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-muted text-xs block mb-1">Ticker</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca…" className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-white w-28 outline-none focus:border-accent" />
        </div>
        <div>
          <label className="text-muted text-xs block mb-1">RSI min</label>
          <input type="number" value={minRsi} onChange={(e) => setMinRsi(e.target.value)} placeholder="0" className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-white w-20 outline-none focus:border-accent" />
        </div>
        <div>
          <label className="text-muted text-xs block mb-1">RSI max</label>
          <input type="number" value={maxRsi} onChange={(e) => setMaxRsi(e.target.value)} placeholder="100" className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-white w-20 outline-none focus:border-accent" />
        </div>
        <div>
          <label className="text-muted text-xs block mb-1">Rend. 1M min%</label>
          <input type="number" value={minRet} onChange={(e) => setMinRet(e.target.value)} placeholder="-∞" className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-white w-24 outline-none focus:border-accent" />
        </div>
        <div>
          <label className="text-muted text-xs block mb-1">Rend. 1M max%</label>
          <input type="number" value={maxRet} onChange={(e) => setMaxRet(e.target.value)} placeholder="+∞" className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-white w-24 outline-none focus:border-accent" />
        </div>
        <button onClick={() => { setSearch(""); setMinRsi(""); setMaxRsi(""); setMinRet(""); setMaxRet(""); }} className="text-muted text-xs hover:text-white mt-4">Reset filtri</button>
      </div>

      {loading ? (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-muted text-sm">Caricamento {universe.length} ticker...</p>
          <div className="mt-2 h-2 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full animate-pulse w-1/2" />
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className={`${th} text-left`} onClick={() => toggleSort("ticker")}>Ticker {sortKey === "ticker" ? (sortDir === "desc" ? "↓" : "↑") : ""}</th>
                <th className={th} onClick={() => toggleSort("price")}>Prezzo {sortKey === "price" ? (sortDir === "desc" ? "↓" : "↑") : ""}</th>
                <th className={th} onClick={() => toggleSort("change1d")}>1D% {sortKey === "change1d" ? (sortDir === "desc" ? "↓" : "↑") : ""}</th>
                <th className={th} onClick={() => toggleSort("return1m")}>1M% {sortKey === "return1m" ? (sortDir === "desc" ? "↓" : "↑") : ""}</th>
                <th className={th} onClick={() => toggleSort("rsi")}>RSI {sortKey === "rsi" ? (sortDir === "desc" ? "↓" : "↑") : ""}</th>
                <th className={th} onClick={() => toggleSort("volume")}>Volume {sortKey === "volume" ? (sortDir === "desc" ? "↓" : "↑") : ""}</th>
                <th className={th} onClick={() => toggleSort("pe")}>P/E {sortKey === "pe" ? (sortDir === "desc" ? "↓" : "↑") : ""}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.ticker}
                  className="border-b border-border/50 hover:bg-white/5 cursor-pointer transition-colors"
                  onClick={() => router.push(`/equity/${row.ticker}`)}
                >
                  <td className="px-3 py-2 text-sm font-semibold text-white">{row.ticker}</td>
                  <td className={td}>${row.price.toFixed(2)}</td>
                  <td className={`${td} ${row.change1d >= 0 ? "text-positive" : "text-negative"}`}>
                    {row.change1d >= 0 ? "+" : ""}{row.change1d.toFixed(2)}%
                  </td>
                  <td className={`${td} ${(row.return1m ?? 0) >= 0 ? "text-positive" : "text-negative"}`}>
                    {row.return1m !== undefined ? `${row.return1m >= 0 ? "+" : ""}${row.return1m.toFixed(1)}%` : "—"}
                  </td>
                  <td className={`${td} ${row.rsi !== undefined ? (row.rsi >= 70 ? "text-negative" : row.rsi <= 30 ? "text-positive" : "text-white") : "text-muted"}`}>
                    {row.rsi?.toFixed(1) ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-sm text-muted text-right">
                    {row.volume ? (row.volume / 1_000_000).toFixed(1) + "M" : "—"}
                  </td>
                  <td className={td}>{row.pe?.toFixed(1) ?? "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-muted text-sm">Nessun risultato con i filtri correnti.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add Screener to Sidebar**

In `frontend/components/layout/Sidebar.tsx`, add to NAV:
```tsx
import { BarChart2, TrendingUp, Globe, Briefcase, LayoutDashboard, Search, FlaskConical, Filter, Calendar } from "lucide-react";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/equity/AAPL", label: "Azioni", icon: TrendingUp },
  { href: "/crypto", label: "Crypto", icon: BarChart2 },
  { href: "/macro", label: "Macro", icon: Globe },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase },
  { href: "/analisi", label: "Analisi", icon: FlaskConical },
  { href: "/screener", label: "Screener", icon: Filter },
  { href: "/earnings", label: "Earnings", icon: Calendar },
];
```

- [ ] **Step 5: Commit**

```bash
cd frontend && git add lib/screener.ts app/screener/ components/layout/Sidebar.tsx
git commit -m "feat: stock screener with RSI/return/PE filters and sortable table"
```

---

## Task 7: Earnings Calendar

**Files:**
- Create: `frontend/app/earnings/layout.tsx`
- Create: `frontend/app/earnings/page.tsx`

- [ ] **Step 1: Add getEarningsCalendar to lib/openbb.ts**

In `frontend/lib/openbb.ts`, add:

```ts
export interface EarningsEvent {
  symbol: string;
  date: string;
  eps_estimate?: number;
  eps_actual?: number;
  revenue_estimate?: number;
  revenue_actual?: number;
}

export async function getEarningsCalendar(symbols: string[]): Promise<EarningsEvent[]> {
  const results = await Promise.allSettled(
    symbols.map((s) =>
      obbFetch<EarningsEvent>("equity/calendar/earnings", {
        symbol: s,
        provider: "yfinance",
      })
    )
  );
  return results
    .filter((r): r is PromiseFulfilledResult<EarningsEvent[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);
}
```

- [ ] **Step 2: Create earnings/layout.tsx**

```tsx
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Earnings | OpenBB" };
export default function EarningsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 3: Create earnings/page.tsx**

```tsx
"use client";

import { useState, useEffect } from "react";
import { getEarningsCalendar } from "@/lib/openbb";
import { useWatchlist } from "@/components/overview/WatchlistManager";
import type { EarningsEvent } from "@/lib/openbb";

export default function EarningsPage() {
  const { tickers } = useWatchlist();
  const [events, setEvents] = useState<EarningsEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (tickers.length === 0) return;
    setLoading(true);
    setError("");
    getEarningsCalendar(tickers)
      .then((data) => {
        const sorted = data.sort((a, b) => a.date.localeCompare(b.date));
        setEvents(sorted);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tickers.join(",")]);

  const today = new Date().toISOString().split("T")[0];
  const upcoming = events.filter((e) => e.date >= today);
  const past = events.filter((e) => e.date < today).reverse();

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-bold text-white">Earnings Calendar</h1>
      <p className="text-muted text-sm">Watchlist corrente: {tickers.join(", ") || "—"}</p>

      {loading && <p className="text-muted text-sm">Caricamento...</p>}
      {error && <p className="text-negative text-sm">{error}</p>}

      {!loading && upcoming.length > 0 && (
        <section>
          <h2 className="text-white font-semibold mb-2">Prossimi earnings</h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-muted text-xs uppercase px-4 py-2 text-left">Ticker</th>
                  <th className="text-muted text-xs uppercase px-4 py-2 text-left">Data</th>
                  <th className="text-muted text-xs uppercase px-4 py-2 text-right">EPS stima</th>
                  <th className="text-muted text-xs uppercase px-4 py-2 text-right">Rev. stima</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((ev, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-white/5">
                    <td className="px-4 py-2 text-sm font-semibold text-white">{ev.symbol}</td>
                    <td className="px-4 py-2 text-sm text-white">{ev.date}</td>
                    <td className="px-4 py-2 text-sm text-right text-muted">{ev.eps_estimate?.toFixed(2) ?? "—"}</td>
                    <td className="px-4 py-2 text-sm text-right text-muted">
                      {ev.revenue_estimate ? `$${(ev.revenue_estimate / 1e9).toFixed(2)}B` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!loading && past.length > 0 && (
        <section>
          <h2 className="text-white font-semibold mb-2">Recenti (con risultati)</h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-muted text-xs uppercase px-4 py-2 text-left">Ticker</th>
                  <th className="text-muted text-xs uppercase px-4 py-2 text-left">Data</th>
                  <th className="text-muted text-xs uppercase px-4 py-2 text-right">EPS stima</th>
                  <th className="text-muted text-xs uppercase px-4 py-2 text-right">EPS effettivo</th>
                  <th className="text-muted text-xs uppercase px-4 py-2 text-right">Beat?</th>
                </tr>
              </thead>
              <tbody>
                {past.slice(0, 20).map((ev, i) => {
                  const beat = ev.eps_actual !== undefined && ev.eps_estimate !== undefined
                    ? ev.eps_actual > ev.eps_estimate
                    : null;
                  return (
                    <tr key={i} className="border-b border-border/50 hover:bg-white/5">
                      <td className="px-4 py-2 text-sm font-semibold text-white">{ev.symbol}</td>
                      <td className="px-4 py-2 text-sm text-muted">{ev.date}</td>
                      <td className="px-4 py-2 text-sm text-right text-muted">{ev.eps_estimate?.toFixed(2) ?? "—"}</td>
                      <td className="px-4 py-2 text-sm text-right text-white">{ev.eps_actual?.toFixed(2) ?? "—"}</td>
                      <td className={`px-4 py-2 text-sm text-right font-medium ${beat === true ? "text-positive" : beat === false ? "text-negative" : "text-muted"}`}>
                        {beat === null ? "—" : beat ? "✓ Beat" : "✗ Miss"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!loading && events.length === 0 && tickers.length > 0 && (
        <p className="text-muted text-sm">Nessun dato earnings disponibile per i ticker in watchlist.</p>
      )}

      {tickers.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted">
          Aggiungi ticker alla watchlist per vedere il calendario earnings.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
cd frontend && git add app/earnings/ lib/openbb.ts
git commit -m "feat: earnings calendar page with upcoming/past events and beat/miss"
```

---

## Task 8: UX Quick Wins

### 8a: Keyboard shortcut — `g` to focus search

**Files:**
- Create: `frontend/hooks/useKeyboardShortcut.ts`
- Modify: `frontend/components/layout/Sidebar.tsx`

- [ ] **Step 1: Create useKeyboardShortcut hook**

Create `frontend/hooks/useKeyboardShortcut.ts`:

```ts
import { useEffect } from "react";

export function useKeyboardShortcut(key: string, callback: () => void) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Ignore when user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (e.key === key) {
        e.preventDefault();
        callback();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [key, callback]);
}
```

- [ ] **Step 2: Wire into Sidebar**

In `frontend/components/layout/Sidebar.tsx`, import and use:

```tsx
import { useRef, useCallback } from "react";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
```

Add inside component:
```tsx
const searchRef = useRef<HTMLInputElement>(null);
const focusSearch = useCallback(() => searchRef.current?.focus(), []);
useKeyboardShortcut("/", focusSearch);
```

Add `ref={searchRef}` to the search `<input>` element. Also add a keyboard hint next to the placeholder:

Change the input:
```tsx
<input
  ref={searchRef}
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  placeholder="Cerca ticker… (/)"
  className="w-full bg-surface border border-border rounded-lg pl-7 pr-3 py-1.5 text-xs text-white placeholder:text-muted outline-none focus:border-accent"
/>
```

- [ ] **Step 3: Commit**

```bash
cd frontend && git add hooks/useKeyboardShortcut.ts components/layout/Sidebar.tsx
git commit -m "feat: keyboard shortcut / to focus ticker search"
```

---

### 8b: Persistent active tab preference

**Files:**
- Modify: `frontend/app/equity/[ticker]/page.tsx`

- [ ] **Step 1: Persist tab to localStorage**

In `frontend/app/equity/[ticker]/page.tsx`, replace:

```tsx
const [activeTab, setActiveTab] = useState<"indicatori" | "fondamentali" | "news" | "confronto">("indicatori");
```

with:

```tsx
const [activeTab, setActiveTab] = useState<"indicatori" | "fondamentali" | "news" | "confronto">(() => {
  if (typeof window === "undefined") return "indicatori";
  return (localStorage.getItem("equity_active_tab") as "indicatori" | "fondamentali" | "news" | "confronto") ?? "indicatori";
});
```

Wrap `setActiveTab` calls to also persist:

```tsx
function handleTabChange(tab: "indicatori" | "fondamentali" | "news" | "confronto") {
  localStorage.setItem("equity_active_tab", tab);
  setActiveTab(tab);
}
```

Replace all `setActiveTab(tab)` calls in the tab buttons with `handleTabChange(tab)`.

- [ ] **Step 2: Commit**

```bash
cd frontend && git add app/equity/\[ticker\]/page.tsx
git commit -m "feat: persist equity active tab to localStorage"
```

---

### 8c: Export chart to PNG

**Files:**
- Modify: `frontend/components/charts/PriceChart.tsx`

- [ ] **Step 1: Add export button to PriceChart**

Add a download button that uses the browser's SVG-to-canvas approach. In `frontend/components/charts/PriceChart.tsx`:

Add a `useRef` to wrap the chart div, and an export function:

```tsx
import { useRef } from "react";
import { Download } from "lucide-react";
```

Add inside component:
```tsx
const chartRef = useRef<HTMLDivElement>(null);

async function exportPng() {
  const el = chartRef.current;
  if (!el) return;
  const svgEl = el.querySelector("svg");
  if (!svgEl) return;

  const svgData = new XMLSerializer().serializeToString(svgEl);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const img = new Image();
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  await new Promise<void>((resolve) => {
    img.onload = () => {
      canvas.width = svgEl.clientWidth * 2;
      canvas.height = svgEl.clientHeight * 2;
      ctx.fillStyle = "#0f1117";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve();
    };
    img.src = url;
  });

  const link = document.createElement("a");
  link.download = `chart.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
```

Wrap the ResponsiveContainer div with `<div ref={chartRef}>`.

Add a Download button in the toolbar (next to EMA toggles):

```tsx
<button onClick={exportPng} className="ml-2 text-muted hover:text-white" title="Esporta PNG">
  <Download size={14} />
</button>
```

- [ ] **Step 2: Commit**

```bash
cd frontend && git add components/charts/PriceChart.tsx
git commit -m "feat: export chart to PNG via SVG → canvas"
```

---

## Task 9: Final verification

- [ ] **Step 1: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 2: Run tests**

```bash
cd frontend && npm test 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 3: Build check**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Expected: successful build, no errors.

- [ ] **Step 4: Final commit**

```bash
cd frontend && git add -p && git commit -m "fix: final cleanup after dashboard upgrades"
```
