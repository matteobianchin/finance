# OpenBB Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Costruire una dashboard finanziaria personale (Next.js 14) che usa l'OpenBB Platform come backend REST API, con sezioni Overview, Azioni (+ indicatori tecnici), Crypto, Macro e Portfolio.

**Architecture:** Next.js 14 frontend chiama direttamente l'OpenBB Platform REST API su `:6900`. Nessun backend custom — tutto il data fetching passa per `lib/openbb.ts`. Orchestrato via Docker Compose con un worker placeholder pronto per alerts futuri.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Recharts, technicalindicators, papaparse, Vitest, React Testing Library

---

## File Map

```
OpenBB/
├── docker-compose.yml
├── vecchio/
│   └── Dockerfile.api              ← Containerizza OpenBB Platform
├── worker/
│   ├── main.py                     ← Placeholder scheduler (non attivo)
│   ├── checks/.gitkeep
│   ├── notify/.gitkeep
│   ├── requirements.txt
│   └── Dockerfile
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── next.config.ts
    ├── tailwind.config.ts
    ├── tsconfig.json
    ├── app/
    │   ├── layout.tsx              ← Root layout con sidebar
    │   ├── globals.css
    │   ├── page.tsx                ← Overview (watchlist + macro widgets)
    │   ├── equity/[ticker]/
    │   │   └── page.tsx            ← Dettaglio azione
    │   ├── crypto/
    │   │   └── page.tsx            ← Crypto top 10 + grafici
    │   ├── macro/
    │   │   └── page.tsx            ← Serie FRED
    │   └── portfolio/
    │       └── page.tsx            ← Import CSV + P&L
    ├── components/
    │   ├── layout/
    │   │   └── Sidebar.tsx         ← Nav links + ticker search input
    │   ├── charts/
    │   │   ├── PriceChart.tsx      ← Grafico storico con timeframe selector
    │   │   ├── SparklineChart.tsx  ← Mini grafico per watchlist card
    │   │   ├── IndicatorChart.tsx  ← RSI / MACD / Bollinger sub-chart
    │   │   └── AllocationPieChart.tsx ← Pie allocazione portfolio
    │   ├── overview/
    │   │   ├── WatchlistCard.tsx   ← Card singolo ticker (prezzo + sparkline)
    │   │   ├── WatchlistManager.tsx ← Aggiungi/rimuovi ticker, salva in localStorage
    │   │   └── MacroWidget.tsx     ← Widget singolo dato macro (FED, 10Y, VIX)
    │   ├── equity/
    │   │   ├── FundamentalsTable.tsx ← Revenue, utile netto, P/E, EPS
    │   │   ├── NewsFeed.tsx        ← Ultimi 10 articoli
    │   │   ├── SignalsPanel.tsx    ← Lettura RSI/MACD (overbought/oversold)
    │   │   └── AIAnalysisButton.tsx ← Pulsante disabilitato (placeholder v2)
    │   ├── crypto/
    │   │   └── CryptoTable.tsx     ← Tabella top 10 con prezzi e variazioni
    │   ├── macro/
    │   │   └── MacroSeriesChart.tsx ← Grafico serie FRED con label
    │   └── portfolio/
    │       ├── CSVImport.tsx       ← Drag & drop / file input + validazione
    │       └── PortfolioTable.tsx  ← Tabella posizioni con P&L
    ├── lib/
    │   ├── openbb.ts               ← Fetch wrapper centralizzato per OpenBB API
    │   └── portfolio.ts            ← Parse CSV + calcolo P&L
    ├── types/
    │   └── openbb.ts               ← TypeScript types per responses OpenBB
    └── __tests__/
        ├── lib/
        │   ├── openbb.test.ts
        │   └── portfolio.test.ts
        └── components/
            └── WatchlistManager.test.tsx
```

---

## Milestone 1 — Infrastruttura

### Task 1: Docker Compose + Backend Dockerfile

**Files:**
- Create: `docker-compose.yml`
- Create: `vecchio/Dockerfile.api`
- Create: `worker/Dockerfile`
- Create: `worker/main.py`
- Create: `worker/requirements.txt`

- [ ] **Step 1: Crea `vecchio/Dockerfile.api`**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Dipendenze di sistema
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Copia e installa OpenBB Platform
COPY openbb_platform ./openbb_platform
COPY pyproject.toml ./pyproject.toml 2>/dev/null || true

RUN pip install --no-cache-dir \
    "openbb-core[uvicorn]" \
    openbb-yfinance \
    openbb-fmp \
    openbb-fred \
    openbb-polygon \
    openbb-tiingo \
    openbb-alpha-vantage

# Copia user_settings con le API keys
COPY user_settings.json /root/.openbb_platform/user_settings.json

EXPOSE 6900

CMD ["uvicorn", "openbb_core.api.rest_api:app", "--host", "0.0.0.0", "--port", "6900"]
```

- [ ] **Step 2: Copia user_settings.json in vecchio/**

```bash
cp C:/Users/matte/.openbb_platform/user_settings.json vecchio/user_settings.json
```

Aggiungi a `vecchio/.gitignore` (crea se non esiste):
```
user_settings.json
```

- [ ] **Step 3: Crea `worker/requirements.txt`**

```
apscheduler==3.10.4
httpx==0.27.0
python-dotenv==1.0.1
```

- [ ] **Step 4: Crea `worker/main.py`**

```python
"""
Worker placeholder per alerts e analisi automatica.
Non attivo in v1 — struttura pronta per v2.

Per attivare in futuro:
1. Aggiungi checks in worker/checks/
2. Aggiungi canali notifica in worker/notify/
3. Imposta WORKER_ENABLED=true in .env
"""
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main():
    enabled = os.getenv("WORKER_ENABLED", "false").lower() == "true"
    if not enabled:
        logger.info("Worker disabilitato (WORKER_ENABLED=false). Struttura pronta per v2.")
        return

    # In v2: importa scheduler, carica checks, avvia loop
    logger.info("Worker attivo — caricamento checks...")


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Crea `worker/Dockerfile`**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "main.py"]
```

- [ ] **Step 6: Crea `worker/checks/.gitkeep` e `worker/notify/.gitkeep`**

```bash
touch worker/checks/.gitkeep worker/notify/.gitkeep
```

- [ ] **Step 7: Crea `docker-compose.yml`**

```yaml
services:
  backend:
    build:
      context: ./vecchio
      dockerfile: Dockerfile.api
    ports:
      - "6900:6900"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6900/api/v1/system/status"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:6900
    depends_on:
      backend:
        condition: service_healthy

  worker:
    build: ./worker
    env_file: .env
    environment:
      - WORKER_ENABLED=false
      - OPENBB_API_URL=http://backend:6900
    depends_on:
      - backend
    restart: "no"
```

- [ ] **Step 8: Commit**

```bash
git init
git add docker-compose.yml vecchio/Dockerfile.api vecchio/.gitignore worker/
git commit -m "feat: infrastruttura Docker Compose con backend OpenBB e worker placeholder"
```

---

### Task 2: Scaffolding Next.js

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/next.config.ts`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/Dockerfile`

- [ ] **Step 1: Crea `frontend/package.json`**

```json
{
  "name": "openbb-dashboard",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest",
    "test:ui": "vitest --ui"
  },
  "dependencies": {
    "next": "14.2.3",
    "react": "^18",
    "react-dom": "^18",
    "recharts": "^2.12.4",
    "papaparse": "^5.4.1",
    "technicalindicators": "^3.1.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.3.0",
    "lucide-react": "^0.383.0",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-tooltip": "^1.0.7"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "@types/papaparse": "^5.3.14",
    "tailwindcss": "^3.4.3",
    "autoprefixer": "^10.4.19",
    "postcss": "^8",
    "vitest": "^1.6.0",
    "@vitejs/plugin-react": "^4.3.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.5",
    "@testing-library/user-event": "^14.5.2",
    "jsdom": "^24.1.0"
  }
}
```

- [ ] **Step 2: Installa le dipendenze**

```bash
cd frontend
npm install
```

Expected: `node_modules/` creata, nessun errore.

- [ ] **Step 3: Crea `frontend/next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/openbb/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6900"}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 4: Crea `frontend/tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "#0f1117",
        card: "#1a1d27",
        border: "#2a2d3a",
        accent: "#3b82f6",
        positive: "#22c55e",
        negative: "#ef4444",
        muted: "#6b7280",
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 5: Crea `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 6: Crea `frontend/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["__tests__/setup.ts"],
    globals: true,
  },
});
```

- [ ] **Step 7: Crea `frontend/__tests__/setup.ts`**

```ts
import "@testing-library/jest-dom";
```

- [ ] **Step 8: Crea `frontend/Dockerfile`**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 9: Crea `frontend/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #0f1117;
  color: #e5e7eb;
}
```

- [ ] **Step 10: Commit**

```bash
cd ..
git add frontend/
git commit -m "feat: scaffolding Next.js 14 con Tailwind, Vitest e Dockerfile"
```

---

## Milestone 2 — Layer Dati

### Task 3: TypeScript types per OpenBB API

**Files:**
- Create: `frontend/types/openbb.ts`

- [ ] **Step 1: Crea `frontend/types/openbb.ts`**

```ts
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
```

- [ ] **Step 2: Verifica che TypeScript non abbia errori**

```bash
cd frontend
npx tsc --noEmit
```

Expected: nessun output (nessun errore).

- [ ] **Step 3: Commit**

```bash
git add frontend/types/
git commit -m "feat: TypeScript types per OpenBB API responses"
```

---

### Task 4: OpenBB API wrapper (`lib/openbb.ts`)

**Files:**
- Create: `frontend/lib/openbb.ts`
- Create: `frontend/__tests__/lib/openbb.test.ts`

- [ ] **Step 1: Scrivi il test (RED)**

Crea `frontend/__tests__/lib/openbb.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPriceHistory,
  getQuote,
  searchEquity,
  getIncomeStatement,
  getNews,
  getFredSeries,
} from "@/lib/openbb";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockOBBResponse<T>(results: T[]) {
  return {
    ok: true,
    json: async () => ({ results, provider: "yfinance", warnings: null, metadata: null }),
  };
}

beforeEach(() => {
  mockFetch.mockReset();
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:6900";
});

describe("getPriceHistory", () => {
  it("returns price bars for a valid ticker", async () => {
    const bars = [{ date: "2024-01-02", open: 185, high: 187, low: 184, close: 186, volume: 1000000 }];
    mockFetch.mockResolvedValueOnce(mockOBBResponse(bars));

    const result = await getPriceHistory("AAPL", "1M");
    expect(result).toHaveLength(1);
    expect(result[0].close).toBe(186);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/openbb/equity/price/historical")
    );
  });

  it("throws ApiError on HTTP failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    await expect(getPriceHistory("INVALID", "1M")).rejects.toThrow("OpenBB API error");
  });
});

describe("getQuote", () => {
  it("returns current quote", async () => {
    const quote = [{ symbol: "AAPL", price: 185.5, day_change: 1.2, day_change_percent: 0.65 }];
    mockFetch.mockResolvedValueOnce(mockOBBResponse(quote));

    const result = await getQuote("AAPL");
    expect(result.price).toBe(185.5);
    expect(result.day_change_percent).toBe(0.65);
  });
});

describe("searchEquity", () => {
  it("returns search results", async () => {
    const results = [{ symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ" }];
    mockFetch.mockResolvedValueOnce(mockOBBResponse(results));

    const result = await searchEquity("Apple");
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe("AAPL");
  });

  it("returns empty array for empty query", async () => {
    const result = await searchEquity("");
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("getFredSeries", () => {
  it("returns FRED series data", async () => {
    const series = [{ date: "2024-01-01", value: 5.33 }];
    mockFetch.mockResolvedValueOnce(mockOBBResponse(series));

    const result = await getFredSeries("DGS10");
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(5.33);
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

```bash
cd frontend
npm test
```

Expected: FAIL — "Cannot find module '@/lib/openbb'"

- [ ] **Step 3: Implementa `frontend/lib/openbb.ts`**

```ts
import type {
  OBBResponse,
  PriceBar,
  Quote,
  SearchResult,
  IncomeStatement,
  KeyMetrics,
  NewsArticle,
  FredSeries,
} from "@/types/openbb";

const BASE = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1`
  : "/api/openbb";

// Timeframe -> parametri start_date + interval
const TIMEFRAME_PARAMS: Record<string, { start_date: string; interval?: string }> = {
  "1D": { start_date: daysAgo(2), interval: "5m" },
  "1W": { start_date: daysAgo(7) },
  "1M": { start_date: daysAgo(30) },
  "6M": { start_date: daysAgo(180) },
  "1Y": { start_date: daysAgo(365) },
  "5Y": { start_date: daysAgo(1825) },
};

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

async function obbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T[]> {
  const url = new URL(`${BASE}/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) throw new Error(`OpenBB API error: ${res.status} on ${path}`);
    const data: OBBResponse<T> = await res.json();
    return data.results;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getPriceHistory(symbol: string, timeframe: string): Promise<PriceBar[]> {
  const params = TIMEFRAME_PARAMS[timeframe] ?? TIMEFRAME_PARAMS["1M"];
  return obbFetch<PriceBar>("equity/price/historical", {
    symbol,
    provider: "yfinance",
    ...params,
  });
}

export async function getCryptoPriceHistory(symbol: string, timeframe: string): Promise<PriceBar[]> {
  const params = TIMEFRAME_PARAMS[timeframe] ?? TIMEFRAME_PARAMS["1M"];
  return obbFetch<PriceBar>("crypto/price/historical", {
    symbol,
    provider: "yfinance",
    ...params,
  });
}

export async function getQuote(symbol: string): Promise<Quote> {
  const results = await obbFetch<Quote>("equity/price/quote", {
    symbol,
    provider: "yfinance",
  });
  if (!results[0]) throw new Error(`No quote for ${symbol}`);
  return results[0];
}

export async function searchEquity(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  return obbFetch<SearchResult>("equity/search", { query, provider: "yfinance" });
}

export async function getIncomeStatement(symbol: string): Promise<IncomeStatement[]> {
  return obbFetch<IncomeStatement>("equity/fundamental/income", {
    symbol,
    provider: "fmp",
    period: "annual",
    limit: "5",
  });
}

export async function getKeyMetrics(symbol: string): Promise<KeyMetrics[]> {
  return obbFetch<KeyMetrics>("equity/fundamental/metrics", {
    symbol,
    provider: "fmp",
    limit: "5",
  });
}

export async function getNews(symbols: string): Promise<NewsArticle[]> {
  return obbFetch<NewsArticle>("equity/news", {
    symbols,
    provider: "tiingo",
    limit: "10",
  });
}

export async function getFredSeries(
  symbol: string,
  startDate?: string
): Promise<FredSeries[]> {
  return obbFetch<FredSeries>("economy/fred_series", {
    symbol,
    provider: "fred",
    ...(startDate ? { start_date: startDate } : { start_date: daysAgo(365 * 5) }),
  });
}

export async function getCryptoTop10(): Promise<Quote[]> {
  const symbols = ["BTC-USD", "ETH-USD", "BNB-USD", "SOL-USD", "XRP-USD",
                   "ADA-USD", "AVAX-USD", "DOGE-USD", "DOT-USD", "MATIC-USD"];
  const results = await Promise.allSettled(symbols.map((s) => getQuote(s)));
  return results
    .filter((r): r is PromiseFulfilledResult<Quote> => r.status === "fulfilled")
    .map((r) => r.value);
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

```bash
npm test
```

Expected: tutti i test PASS (6 tests in openbb.test.ts).

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/openbb.ts frontend/__tests__/lib/openbb.test.ts
git commit -m "feat: OpenBB API wrapper con fetch centralizzato e timeout 10s"
```

---

### Task 5: Portfolio parser (`lib/portfolio.ts`)

**Files:**
- Create: `frontend/lib/portfolio.ts`
- Create: `frontend/__tests__/lib/portfolio.test.ts`

- [ ] **Step 1: Scrivi il test (RED)**

```ts
// frontend/__tests__/lib/portfolio.test.ts
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
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

```bash
npm test __tests__/lib/portfolio.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/portfolio'"

- [ ] **Step 3: Implementa `frontend/lib/portfolio.ts`**

```ts
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

export function calcPositions(
  rows: PortfolioRow[],
  prices: Record<string, number>
): PortfolioPosition[] {
  return rows
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
```

- [ ] **Step 4: Esegui i test**

```bash
npm test __tests__/lib/portfolio.test.ts
```

Expected: tutti i test PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/portfolio.ts frontend/__tests__/lib/portfolio.test.ts
git commit -m "feat: portfolio CSV parser e calcolo P&L"
```

---

## Milestone 3 — Layout e Shell

### Task 6: Layout root + Sidebar

**Files:**
- Create: `frontend/app/layout.tsx`
- Create: `frontend/components/layout/Sidebar.tsx`

- [ ] **Step 1: Crea `frontend/components/layout/Sidebar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, TrendingUp, Globe, Briefcase, LayoutDashboard } from "lucide-react";
import { clsx } from "clsx";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/equity/AAPL", label: "Azioni", icon: TrendingUp },
  { href: "/crypto", label: "Crypto", icon: BarChart2 },
  { href: "/macro", label: "Macro", icon: Globe },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 min-h-screen bg-card border-r border-border flex flex-col p-4 gap-1">
      <div className="text-white font-bold text-lg mb-6 px-2">
        📈 OpenBB
      </div>
      {NAV.map(({ href, label, icon: Icon }) => {
        const isActive =
          href === "/" ? pathname === "/" : pathname.startsWith(href.split("/")[1] ? `/${href.split("/")[1]}` : href);
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
              isActive
                ? "bg-accent/20 text-accent font-medium"
                : "text-muted hover:text-white hover:bg-white/5"
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        );
      })}
    </aside>
  );
}
```

- [ ] **Step 2: Crea `frontend/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "OpenBB Dashboard",
  description: "Dashboard finanziaria personale",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="flex min-h-screen bg-surface text-gray-100">
        <Sidebar />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Avvia il dev server e verifica visivamente**

```bash
cd frontend
npm run dev
```

Expected: `http://localhost:3000` mostra sidebar dark con 5 link, nessun errore in console.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/layout.tsx frontend/components/layout/
git commit -m "feat: layout root con sidebar navigazione"
```

---

## Milestone 4 — Overview

### Task 7: MacroWidget + WatchlistCard

**Files:**
- Create: `frontend/components/charts/SparklineChart.tsx`
- Create: `frontend/components/overview/MacroWidget.tsx`
- Create: `frontend/components/overview/WatchlistCard.tsx`
- Create: `frontend/components/overview/WatchlistManager.tsx`

- [ ] **Step 1: Crea `frontend/components/charts/SparklineChart.tsx`**

```tsx
"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";
import type { PriceBar } from "@/types/openbb";

interface Props {
  data: PriceBar[];
  positive: boolean;
}

export default function SparklineChart({ data, positive }: Props) {
  const color = positive ? "#22c55e" : "#ef4444";
  const chartData = data.map((d) => ({ v: d.close }));

  return (
    <ResponsiveContainer width="100%" height={48}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Crea `frontend/components/overview/MacroWidget.tsx`**

```tsx
interface Props {
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
}

export default function MacroWidget({ label, value, change, positive }: Props) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
      <span className="text-muted text-xs uppercase tracking-wide">{label}</span>
      <span className="text-white text-2xl font-semibold">{value}</span>
      {change && (
        <span className={`text-sm ${positive ? "text-positive" : "text-negative"}`}>
          {change}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Crea `frontend/components/overview/WatchlistCard.tsx`**

```tsx
"use client";

import Link from "next/link";
import SparklineChart from "@/components/charts/SparklineChart";
import type { Quote, PriceBar } from "@/types/openbb";

interface Props {
  quote: Quote;
  history: PriceBar[];
  onRemove: (symbol: string) => void;
}

export default function WatchlistCard({ quote, history, onRemove }: Props) {
  const positive = quote.day_change_percent >= 0;

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2">
      <div className="flex justify-between items-start">
        <Link href={`/equity/${quote.symbol}`} className="hover:text-accent">
          <span className="font-bold text-white">{quote.symbol}</span>
          {quote.name && (
            <span className="text-muted text-xs block truncate max-w-[120px]">{quote.name}</span>
          )}
        </Link>
        <button
          onClick={() => onRemove(quote.symbol)}
          className="text-muted hover:text-negative text-xs"
          aria-label={`Rimuovi ${quote.symbol}`}
        >
          ✕
        </button>
      </div>
      <SparklineChart data={history} positive={positive} />
      <div className="flex justify-between items-center">
        <span className="text-white font-semibold">${quote.price.toFixed(2)}</span>
        <span className={`text-sm font-medium ${positive ? "text-positive" : "text-negative"}`}>
          {positive ? "+" : ""}
          {quote.day_change_percent.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Crea `frontend/components/overview/WatchlistManager.tsx`**

```tsx
"use client";

import { useState } from "react";

const DEFAULT_WATCHLIST = ["AAPL", "MSFT", "NVDA", "GOOGL"];
const STORAGE_KEY = "openbb_watchlist";

export function useWatchlist() {
  const [tickers, setTickers] = useState<string[]>(() => {
    if (typeof window === "undefined") return DEFAULT_WATCHLIST;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_WATCHLIST;
    } catch {
      return DEFAULT_WATCHLIST;
    }
  });

  function add(symbol: string) {
    const upper = symbol.toUpperCase().trim();
    if (!upper || tickers.includes(upper)) return;
    const next = [...tickers, upper];
    setTickers(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function remove(symbol: string) {
    const next = tickers.filter((t) => t !== symbol);
    setTickers(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  return { tickers, add, remove };
}

interface Props {
  onAdd: (symbol: string) => void;
}

export default function WatchlistManager({ onAdd }: Props) {
  const [input, setInput] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input.trim()) {
      onAdd(input.trim().toUpperCase());
      setInput("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Aggiungi ticker (es. TSLA)"
        className="bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-muted outline-none focus:border-accent w-48"
      />
      <button
        type="submit"
        className="bg-accent hover:bg-accent/80 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
      >
        +
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/components/
git commit -m "feat: componenti Overview — WatchlistCard, MacroWidget, SparklineChart"
```

---

### Task 8: Pagina Overview

**Files:**
- Create: `frontend/app/page.tsx`

- [ ] **Step 1: Crea `frontend/app/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useWatchlist } from "@/components/overview/WatchlistManager";
import WatchlistCard from "@/components/overview/WatchlistCard";
import WatchlistManagerForm from "@/components/overview/WatchlistManager";
import MacroWidget from "@/components/overview/MacroWidget";
import { getQuote, getPriceHistory, getFredSeries } from "@/lib/openbb";
import type { Quote, PriceBar, FredSeries } from "@/types/openbb";

interface WatchlistEntry {
  quote: Quote;
  history: PriceBar[];
}

export default function OverviewPage() {
  const { tickers, add, remove } = useWatchlist();
  const [entries, setEntries] = useState<Record<string, WatchlistEntry>>({});
  const [macroData, setMacroData] = useState<{
    fed: FredSeries[];
    treasury10y: FredSeries[];
  }>({ fed: [], treasury10y: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      const [tickerResults, fedData, t10yData] = await Promise.allSettled([
        Promise.all(
          tickers.map(async (ticker) => {
            const [quote, history] = await Promise.all([
              getQuote(ticker),
              getPriceHistory(ticker, "1M"),
            ]);
            return { ticker, quote, history };
          })
        ),
        getFredSeries("FEDFUNDS"),
        getFredSeries("DGS10"),
      ]);

      if (tickerResults.status === "fulfilled") {
        const map: Record<string, WatchlistEntry> = {};
        tickerResults.value.forEach(({ ticker, quote, history }) => {
          map[ticker] = { quote, history };
        });
        setEntries(map);
      }

      setMacroData({
        fed: fedData.status === "fulfilled" ? fedData.value : [],
        treasury10y: t10yData.status === "fulfilled" ? t10yData.value : [],
      });

      setLoading(false);
    }

    loadAll();
  }, [tickers.join(",")]);

  const lastFed = macroData.fed.at(-1);
  const lastT10y = macroData.treasury10y.at(-1);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        <WatchlistManagerForm onAdd={add} />
      </div>

      {/* Macro widgets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MacroWidget
          label="Tasso FED"
          value={lastFed ? `${lastFed.value?.toFixed(2)}%` : "—"}
        />
        <MacroWidget
          label="Treasury 10Y"
          value={lastT10y ? `${lastT10y.value?.toFixed(2)}%` : "—"}
        />
        <MacroWidget label="VIX" value="—" />
        <MacroWidget label="S&P 500" value="—" />
      </div>

      {/* Watchlist */}
      {loading ? (
        <div className="text-muted text-sm">Caricamento watchlist...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {tickers.map((ticker) => {
            const entry = entries[ticker];
            if (!entry) return null;
            return (
              <WatchlistCard
                key={ticker}
                quote={entry.quote}
                history={entry.history}
                onRemove={remove}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verifica nel browser**

Con il backend OpenBB attivo su `:6900`:
```bash
# In vecchio/
.venv/Scripts/activate
uvicorn openbb_core.api.rest_api:app --host 127.0.0.1 --port 6900 --reload

# In frontend/
npm run dev
```

Expected: `http://localhost:3000` mostra widget macro e 4 cards watchlist (AAPL, MSFT, NVDA, GOOGL).

- [ ] **Step 3: Commit**

```bash
git add frontend/app/page.tsx
git commit -m "feat: pagina Overview con watchlist e macro widgets"
```

---

## Milestone 5 — Azioni

### Task 9: PriceChart + IndicatorChart

**Files:**
- Create: `frontend/components/charts/PriceChart.tsx`
- Create: `frontend/components/charts/IndicatorChart.tsx`

- [ ] **Step 1: Crea `frontend/components/charts/PriceChart.tsx`**

```tsx
"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import type { PriceBar } from "@/types/openbb";

const TIMEFRAMES = ["1D", "1W", "1M", "6M", "1Y", "5Y"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

interface Props {
  data: PriceBar[];
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  loading?: boolean;
}

export default function PriceChart({ data, timeframe, onTimeframeChange, loading }: Props) {
  const first = data[0]?.close ?? 0;
  const last = data.at(-1)?.close ?? 0;
  const positive = last >= first;
  const color = positive ? "#22c55e" : "#ef4444";

  const chartData = data.map((d) => ({
    date: d.date.slice(0, 10),
    close: d.close,
  }));

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex gap-1 mb-4">
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
              formatter={(v: number) => [`$${v.toFixed(2)}`, "Chiusura"]}
            />
            <Line
              type="monotone"
              dataKey="close"
              stroke={color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Crea `frontend/components/charts/IndicatorChart.tsx`**

```tsx
"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

interface DataPoint {
  date: string;
  value: number;
}

interface Props {
  data: DataPoint[];
  label: string;
  color?: string;
  referenceLines?: number[];
  domain?: [number | "auto", number | "auto"];
}

export default function IndicatorChart({
  data,
  label,
  color = "#3b82f6",
  referenceLines = [],
  domain = ["auto", "auto"],
}: Props) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <span className="text-muted text-xs uppercase tracking-wide">{label}</span>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} tickFormatter={(v) => v.slice(5)} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} domain={domain} />
          <Tooltip
            contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }}
            formatter={(v: number) => [v.toFixed(2), label]}
          />
          {referenceLines.map((val) => (
            <ReferenceLine key={val} y={val} stroke="#6b7280" strokeDasharray="4 4" />
          ))}
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/charts/
git commit -m "feat: PriceChart con timeframe selector e IndicatorChart"
```

---

### Task 10: Pannello indicatori tecnici + SignalsPanel

**Files:**
- Create: `frontend/components/equity/SignalsPanel.tsx`

- [ ] **Step 1: Crea `frontend/components/equity/SignalsPanel.tsx`**

```tsx
"use client";

import { useMemo } from "react";
import {
  RSI, MACD, BollingerBands,
} from "technicalindicators";
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

export default function SignalsPanel({ data }: Props) {
  const closes = data.map((d) => d.close);
  const dates = data.map((d) => d.date.slice(0, 10));

  const rsiValues = useMemo(() => {
    if (closes.length < 14) return [];
    return RSI.calculate({ values: closes, period: 14 });
  }, [closes.join(",")]);

  const macdValues = useMemo(() => {
    if (closes.length < 26) return [];
    return MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
  }, [closes.join(",")]);

  const rsiData = rsiValues.map((v, i) => ({
    date: dates[dates.length - rsiValues.length + i],
    value: v,
  }));

  const macdHistData = macdValues.map((v, i) => ({
    date: dates[dates.length - macdValues.length + i],
    value: v.histogram ?? 0,
  }));

  const lastRsi = rsiValues.at(-1);
  const lastMacdHist = macdValues.at(-1)?.histogram ?? 0;
  const rsiSignal = lastRsi !== undefined ? interpretRsi(lastRsi) : null;
  const macdSignal = interpretMacd(lastMacdHist);

  return (
    <div className="space-y-4">
      {/* Riepilogo segnali */}
      <div className="bg-card border border-border rounded-xl p-4 grid grid-cols-2 gap-4">
        <div>
          <span className="text-muted text-xs uppercase">RSI (14)</span>
          <p className="text-white font-semibold">{lastRsi?.toFixed(1) ?? "—"}</p>
          {rsiSignal && (
            <p className={`text-sm ${rsiSignal.color}`}>{rsiSignal.label}</p>
          )}
        </div>
        <div>
          <span className="text-muted text-xs uppercase">MACD</span>
          <p className="text-white font-semibold">{lastMacdHist.toFixed(3)}</p>
          <p className={`text-sm ${macdSignal.color}`}>{macdSignal.label}</p>
        </div>
      </div>

      {/* Grafici indicatori */}
      {rsiData.length > 0 && (
        <IndicatorChart
          data={rsiData}
          label="RSI (14)"
          color="#a78bfa"
          referenceLines={[70, 30]}
          domain={[0, 100]}
        />
      )}

      {macdHistData.length > 0 && (
        <IndicatorChart
          data={macdHistData}
          label="MACD Histogram"
          color="#3b82f6"
          referenceLines={[0]}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/equity/SignalsPanel.tsx
git commit -m "feat: SignalsPanel con RSI e MACD calcolati client-side"
```

---

### Task 11: FundamentalsTable + NewsFeed + AIAnalysisButton

**Files:**
- Create: `frontend/components/equity/FundamentalsTable.tsx`
- Create: `frontend/components/equity/NewsFeed.tsx`
- Create: `frontend/components/equity/AIAnalysisButton.tsx`

- [ ] **Step 1: Crea `frontend/components/equity/FundamentalsTable.tsx`**

```tsx
import type { IncomeStatement } from "@/types/openbb";

interface Props {
  data: IncomeStatement[];
}

function fmt(v: number | null): string {
  if (v === null) return "—";
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toFixed(2)}`;
}

export default function FundamentalsTable({ data }: Props) {
  if (!data.length) return <p className="text-muted text-sm">Dati non disponibili.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted border-b border-border">
            <th className="text-left py-2 pr-4">Anno</th>
            <th className="text-right py-2 pr-4">Revenue</th>
            <th className="text-right py-2 pr-4">Utile netto</th>
            <th className="text-right py-2 pr-4">EPS</th>
            <th className="text-right py-2">EBITDA</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.date} className="border-b border-border/50 hover:bg-white/5">
              <td className="py-2 pr-4 text-white">{row.date.slice(0, 4)}</td>
              <td className="py-2 pr-4 text-right">{fmt(row.revenue)}</td>
              <td className={`py-2 pr-4 text-right ${(row.net_income ?? 0) >= 0 ? "text-positive" : "text-negative"}`}>
                {fmt(row.net_income)}
              </td>
              <td className="py-2 pr-4 text-right">{row.eps?.toFixed(2) ?? "—"}</td>
              <td className="py-2 text-right">{fmt(row.ebitda)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Crea `frontend/components/equity/NewsFeed.tsx`**

```tsx
import type { NewsArticle } from "@/types/openbb";

interface Props {
  articles: NewsArticle[];
}

export default function NewsFeed({ articles }: Props) {
  if (!articles.length) return <p className="text-muted text-sm">Nessuna news disponibile.</p>;

  return (
    <ul className="space-y-3">
      {articles.map((article, i) => (
        <li key={i} className="border-b border-border/50 pb-3 last:border-0">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:text-accent text-sm font-medium leading-snug"
          >
            {article.title}
          </a>
          <p className="text-muted text-xs mt-1">
            {article.source ?? "Fonte sconosciuta"} ·{" "}
            {new Date(article.date).toLocaleDateString("it-IT")}
          </p>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Crea `frontend/components/equity/AIAnalysisButton.tsx`**

```tsx
"use client";

import { BrainCircuit } from "lucide-react";

/**
 * Placeholder per analisi AI — abilitato in v2 quando ANTHROPIC_API_KEY è configurato.
 * In v1 mostra il pulsante disabilitato con tooltip esplicativo.
 */
export default function AIAnalysisButton() {
  return (
    <div className="relative group">
      <button
        disabled
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border text-muted cursor-not-allowed opacity-60 text-sm"
        aria-label="Analisi AI — disponibile in v2"
      >
        <BrainCircuit size={16} />
        Analisi AI
        <span className="text-xs bg-border px-1.5 py-0.5 rounded">v2</span>
      </button>
      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-card border border-border rounded-lg p-2 text-xs text-muted w-56 z-10">
        Disponibile nella prossima versione. Analizzerà prezzi, indicatori e news con Claude AI.
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/components/equity/
git commit -m "feat: FundamentalsTable, NewsFeed e AIAnalysisButton placeholder"
```

---

### Task 12: Pagina Azioni `/equity/[ticker]`

**Files:**
- Create: `frontend/app/equity/[ticker]/page.tsx`

- [ ] **Step 1: Crea `frontend/app/equity/[ticker]/page.tsx`**

```tsx
"use client";

import { useState, useEffect, use } from "react";
import PriceChart from "@/components/charts/PriceChart";
import SignalsPanel from "@/components/equity/SignalsPanel";
import FundamentalsTable from "@/components/equity/FundamentalsTable";
import NewsFeed from "@/components/equity/NewsFeed";
import AIAnalysisButton from "@/components/equity/AIAnalysisButton";
import { getPriceHistory, getIncomeStatement, getNews, getQuote } from "@/lib/openbb";
import type { PriceBar, IncomeStatement, NewsArticle, Quote } from "@/types/openbb";

type Timeframe = "1D" | "1W" | "1M" | "6M" | "1Y" | "5Y";

export default function EquityPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = use(params);
  const symbol = ticker.toUpperCase();

  const [timeframe, setTimeframe] = useState<Timeframe>("3M" as Timeframe);
  const [activeTab, setActiveTab] = useState<"indicatori" | "fondamentali" | "news">("indicatori");
  const [history, setHistory] = useState<PriceBar[]>([]);
  const [fundamentals, setFundamentals] = useState<IncomeStatement[]>([]);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setChartLoading(true);
    setError(null);
    Promise.all([getPriceHistory(symbol, timeframe), getQuote(symbol)])
      .then(([bars, q]) => {
        setHistory(bars);
        setQuote(q);
      })
      .catch((e) => setError(e.message))
      .finally(() => setChartLoading(false));
  }, [symbol, timeframe]);

  useEffect(() => {
    if (activeTab === "fondamentali" && !fundamentals.length) {
      setTabLoading(true);
      getIncomeStatement(symbol)
        .then(setFundamentals)
        .catch(() => setFundamentals([]))
        .finally(() => setTabLoading(false));
    }
    if (activeTab === "news" && !news.length) {
      setTabLoading(true);
      getNews(symbol)
        .then(setNews)
        .catch(() => setNews([]))
        .finally(() => setTabLoading(false));
    }
  }, [activeTab, symbol]);

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-white">{symbol}</h1>
          {quote && (
            <div className="flex items-center gap-3 mt-1">
              <span className="text-3xl font-semibold text-white">${quote.price.toFixed(2)}</span>
              <span className={`text-sm font-medium ${quote.day_change_percent >= 0 ? "text-positive" : "text-negative"}`}>
                {quote.day_change_percent >= 0 ? "+" : ""}
                {quote.day_change_percent.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
        <AIAnalysisButton />
      </div>

      {error && (
        <div className="bg-negative/10 border border-negative/30 rounded-lg p-3 text-negative text-sm">
          Dati non disponibili: {error}
        </div>
      )}

      {/* Grafico prezzi */}
      <PriceChart
        data={history}
        timeframe={timeframe as "1D" | "1W" | "1M" | "6M" | "1Y" | "5Y"}
        onTimeframeChange={(tf) => setTimeframe(tf)}
        loading={chartLoading}
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border pb-0">
        {(["indicatori", "fondamentali", "news"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-accent text-white font-medium"
                : "border-transparent text-muted hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-64">
        {tabLoading ? (
          <p className="text-muted text-sm">Caricamento...</p>
        ) : activeTab === "indicatori" ? (
          <SignalsPanel data={history} />
        ) : activeTab === "fondamentali" ? (
          <FundamentalsTable data={fundamentals} />
        ) : (
          <NewsFeed articles={news} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verifica nel browser**

Vai su `http://localhost:3000/equity/AAPL`.

Expected: grafico prezzi + tab indicatori con RSI/MACD, tab fondamentali, tab news. Pulsante AI disabilitato.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/equity/
git commit -m "feat: pagina Azioni con grafico, indicatori tecnici, fondamentali e news"
```

---

## Milestone 6 — Crypto

### Task 13: Pagina Crypto

**Files:**
- Create: `frontend/components/crypto/CryptoTable.tsx`
- Create: `frontend/app/crypto/page.tsx`

- [ ] **Step 1: Crea `frontend/components/crypto/CryptoTable.tsx`**

```tsx
"use client";

import Link from "next/link";
import type { Quote } from "@/types/openbb";

interface Props {
  data: Quote[];
}

export default function CryptoTable({ data }: Props) {
  if (!data.length) return <p className="text-muted text-sm">Dati non disponibili.</p>;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="border-b border-border">
          <tr className="text-muted">
            <th className="text-left p-4">#</th>
            <th className="text-left p-4">Simbolo</th>
            <th className="text-right p-4">Prezzo</th>
            <th className="text-right p-4">Variazione 24h</th>
            {data[0]?.market_cap && <th className="text-right p-4">Market Cap</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.symbol} className="border-b border-border/50 hover:bg-white/5">
              <td className="p-4 text-muted">{i + 1}</td>
              <td className="p-4">
                <Link
                  href={`/equity/${row.symbol}`}
                  className="text-white hover:text-accent font-medium"
                >
                  {row.symbol.replace("-USD", "")}
                </Link>
                {row.name && <span className="text-muted text-xs block">{row.name}</span>}
              </td>
              <td className="p-4 text-right text-white font-semibold">
                ${row.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className={`p-4 text-right font-medium ${row.day_change_percent >= 0 ? "text-positive" : "text-negative"}`}>
                {row.day_change_percent >= 0 ? "+" : ""}
                {row.day_change_percent.toFixed(2)}%
              </td>
              {row.market_cap && (
                <td className="p-4 text-right text-muted">
                  ${(row.market_cap / 1e9).toFixed(1)}B
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Crea `frontend/app/crypto/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import CryptoTable from "@/components/crypto/CryptoTable";
import { getCryptoTop10 } from "@/lib/openbb";
import type { Quote } from "@/types/openbb";

export default function CryptoPage() {
  const [data, setData] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCryptoTop10()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-bold text-white">Crypto</h1>
      {error && (
        <div className="bg-negative/10 border border-negative/30 rounded-lg p-3 text-negative text-sm">
          Dati non disponibili: {error}
        </div>
      )}
      {loading ? (
        <p className="text-muted text-sm">Caricamento...</p>
      ) : (
        <CryptoTable data={data} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/crypto/ frontend/app/crypto/
git commit -m "feat: pagina Crypto con top 10 prezzi e variazioni"
```

---

## Milestone 7 — Macro

### Task 14: Pagina Macro

**Files:**
- Create: `frontend/components/macro/MacroSeriesChart.tsx`
- Create: `frontend/app/macro/page.tsx`

- [ ] **Step 1: Crea `frontend/components/macro/MacroSeriesChart.tsx`**

```tsx
"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import type { FredSeries } from "@/types/openbb";

interface Props {
  data: FredSeries[];
  label: string;
  unit?: string;
  color?: string;
}

export default function MacroSeriesChart({ data, label, unit = "", color = "#3b82f6" }: Props) {
  const chartData = data
    .filter((d) => d.value !== null)
    .map((d) => ({ date: d.date.slice(0, 7), value: d.value as number }));

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-white font-medium mb-3">{label}</h3>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            interval={Math.floor(chartData.length / 6)}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickFormatter={(v) => `${v}${unit}`}
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }}
            formatter={(v: number) => [`${v.toFixed(2)}${unit}`, label]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Crea `frontend/app/macro/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import MacroSeriesChart from "@/components/macro/MacroSeriesChart";
import { getFredSeries } from "@/lib/openbb";
import type { FredSeries } from "@/types/openbb";

const SERIES = [
  { symbol: "FEDFUNDS", label: "Tasso FED", unit: "%", color: "#ef4444" },
  { symbol: "CPIAUCSL", label: "Inflazione CPI", unit: "%", color: "#f59e0b" },
  { symbol: "GDP",      label: "PIL USA (mld $)", unit: "B", color: "#22c55e" },
  { symbol: "DGS10",   label: "Treasury 10Y", unit: "%", color: "#3b82f6" },
  { symbol: "DGS2",    label: "Treasury 2Y", unit: "%", color: "#a78bfa" },
];

export default function MacroPage() {
  const [seriesData, setSeriesData] = useState<Record<string, FredSeries[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled(
      SERIES.map(({ symbol }) =>
        getFredSeries(symbol).then((data) => ({ symbol, data }))
      )
    ).then((results) => {
      const map: Record<string, FredSeries[]> = {};
      results.forEach((r) => {
        if (r.status === "fulfilled") {
          map[r.value.symbol] = r.value.data;
        }
      });
      setSeriesData(map);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="text-2xl font-bold text-white">Macro</h1>
      {loading ? (
        <p className="text-muted text-sm">Caricamento serie FRED...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SERIES.map(({ symbol, label, unit, color }) => (
            <MacroSeriesChart
              key={symbol}
              data={seriesData[symbol] ?? []}
              label={label}
              unit={unit}
              color={color}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/macro/ frontend/app/macro/
git commit -m "feat: pagina Macro con 5 serie FRED (FED, CPI, PIL, Treasury 2Y/10Y)"
```

---

## Milestone 8 — Portfolio

### Task 15: Pagina Portfolio

**Files:**
- Create: `frontend/components/charts/AllocationPieChart.tsx`
- Create: `frontend/components/portfolio/CSVImport.tsx`
- Create: `frontend/components/portfolio/PortfolioTable.tsx`
- Create: `frontend/app/portfolio/page.tsx`

- [ ] **Step 1: Crea `frontend/components/charts/AllocationPieChart.tsx`**

```tsx
"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { PortfolioPosition } from "@/types/openbb";

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a78bfa", "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#14b8a6"];

interface Props {
  positions: PortfolioPosition[];
}

export default function AllocationPieChart({ positions }: Props) {
  const data = positions.map((p) => ({
    name: p.ticker,
    value: p.current_value,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={100}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }}
          formatter={(v: number) => [`$${v.toFixed(2)}`, "Valore"]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Crea `frontend/components/portfolio/CSVImport.tsx`**

```tsx
"use client";

import { useState, useCallback } from "react";
import { parseCSV } from "@/lib/portfolio";
import type { PortfolioRow } from "@/types/openbb";

interface Props {
  onImport: (rows: PortfolioRow[]) => void;
}

export default function CSVImport({ onImport }: Props) {
  const [errors, setErrors] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  function processFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { rows, errors: parseErrors } = parseCSV(text);
      if (parseErrors.length > 0) {
        setErrors(parseErrors);
      } else {
        setErrors([]);
        onImport(rows);
      }
    };
    reader.readAsText(file);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".csv")) processFile(file);
  }, []);

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          isDragging ? "border-accent bg-accent/5" : "border-border"
        }`}
      >
        <p className="text-muted text-sm mb-2">Trascina un file CSV oppure</p>
        <label className="cursor-pointer">
          <span className="bg-accent hover:bg-accent/80 text-white text-sm px-4 py-2 rounded-lg transition-colors">
            Scegli file
          </span>
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) processFile(file);
            }}
          />
        </label>
        <p className="text-muted text-xs mt-3">
          Formato: <code className="text-white">ticker, quantity, buy_price, buy_date</code>
        </p>
      </div>

      {errors.length > 0 && (
        <div className="bg-negative/10 border border-negative/30 rounded-lg p-3 space-y-1">
          <p className="text-negative text-sm font-medium">Errori nel file CSV:</p>
          {errors.map((err, i) => (
            <p key={i} className="text-negative text-xs">{err}</p>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Crea `frontend/components/portfolio/PortfolioTable.tsx`**

```tsx
import type { PortfolioPosition } from "@/types/openbb";

interface Props {
  positions: PortfolioPosition[];
}

function fmt(v: number): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PortfolioTable({ positions }: Props) {
  const totalValue = positions.reduce((s, p) => s + p.current_value, 0);
  const totalCost = positions.reduce((s, p) => s + p.cost_basis, 0);
  const totalGL = totalValue - totalCost;
  const totalGLPct = totalCost > 0 ? (totalGL / totalCost) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-muted text-xs uppercase">Valore totale</p>
          <p className="text-white text-xl font-bold">{fmt(totalValue)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-muted text-xs uppercase">Costo totale</p>
          <p className="text-white text-xl font-bold">{fmt(totalCost)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-muted text-xs uppercase">P&L totale</p>
          <p className={`text-xl font-bold ${totalGL >= 0 ? "text-positive" : "text-negative"}`}>
            {totalGL >= 0 ? "+" : ""}{fmt(totalGL)}
            <span className="text-sm ml-1">({totalGLPct >= 0 ? "+" : ""}{totalGLPct.toFixed(2)}%)</span>
          </p>
        </div>
      </div>

      {/* Tabella posizioni */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr className="text-muted">
              <th className="text-left p-4">Ticker</th>
              <th className="text-right p-4">Quantità</th>
              <th className="text-right p-4">Prezzo acquisto</th>
              <th className="text-right p-4">Prezzo attuale</th>
              <th className="text-right p-4">Valore</th>
              <th className="text-right p-4">P&L</th>
              <th className="text-right p-4">P&L %</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <tr key={p.ticker} className="border-b border-border/50 hover:bg-white/5">
                <td className="p-4 text-white font-bold">{p.ticker}</td>
                <td className="p-4 text-right">{p.quantity}</td>
                <td className="p-4 text-right">{fmt(p.buy_price)}</td>
                <td className="p-4 text-right">{fmt(p.current_price)}</td>
                <td className="p-4 text-right">{fmt(p.current_value)}</td>
                <td className={`p-4 text-right font-medium ${p.gain_loss >= 0 ? "text-positive" : "text-negative"}`}>
                  {p.gain_loss >= 0 ? "+" : ""}{fmt(p.gain_loss)}
                </td>
                <td className={`p-4 text-right font-medium ${p.gain_loss_pct >= 0 ? "text-positive" : "text-negative"}`}>
                  {p.gain_loss_pct >= 0 ? "+" : ""}{p.gain_loss_pct.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Crea `frontend/app/portfolio/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import CSVImport from "@/components/portfolio/CSVImport";
import PortfolioTable from "@/components/portfolio/PortfolioTable";
import AllocationPieChart from "@/components/charts/AllocationPieChart";
import { getQuote } from "@/lib/openbb";
import { calcPositions } from "@/lib/portfolio";
import type { PortfolioRow, PortfolioPosition } from "@/types/openbb";

export default function PortfolioPage() {
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImport(rows: PortfolioRow[]) {
    setLoading(true);
    setError(null);
    try {
      const uniqueTickers = [...new Set(rows.map((r) => r.ticker))];
      const quoteResults = await Promise.allSettled(
        uniqueTickers.map((t) => getQuote(t).then((q) => ({ ticker: t, price: q.price })))
      );

      const prices: Record<string, number> = {};
      quoteResults.forEach((r) => {
        if (r.status === "fulfilled") {
          prices[r.value.ticker] = r.value.price;
        }
      });

      const failedTickers = uniqueTickers.filter((t) => !(t in prices));
      if (failedTickers.length > 0) {
        setError(`Impossibile recuperare prezzi per: ${failedTickers.join(", ")}`);
      }

      setPositions(calcPositions(rows, prices));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-white">Portfolio</h1>

      <CSVImport onImport={handleImport} />

      {error && (
        <div className="bg-negative/10 border border-negative/30 rounded-lg p-3 text-negative text-sm">
          {error}
        </div>
      )}

      {loading && <p className="text-muted text-sm">Recupero prezzi attuali...</p>}

      {positions.length > 0 && (
        <>
          <PortfolioTable positions={positions} />
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-white font-medium mb-2">Allocazione</h3>
            <AllocationPieChart positions={positions} />
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Esegui tutti i test**

```bash
cd frontend
npm test
```

Expected: tutti i test PASS (openbb.test.ts + portfolio.test.ts).

- [ ] **Step 6: Commit**

```bash
git add frontend/components/portfolio/ frontend/components/charts/AllocationPieChart.tsx frontend/app/portfolio/
git commit -m "feat: pagina Portfolio con import CSV, tabella P&L e pie chart allocazione"
```

---

## Milestone 9 — Verifica finale

### Task 16: Build di produzione e test Docker

**Files:**
- No new files — verifica integrazione

- [ ] **Step 1: Build Next.js di produzione**

```bash
cd frontend
npm run build
```

Expected: Build completata senza errori TypeScript. Output in `.next/`.

- [ ] **Step 2: Verifica tipi TypeScript**

```bash
npx tsc --noEmit
```

Expected: nessun output (nessun errore).

- [ ] **Step 3: Esegui tutti i test**

```bash
npm test
```

Expected: tutti i test PASS.

- [ ] **Step 4: Test Docker Compose**

```bash
cd ..
docker-compose build
docker-compose up
```

Expected:
- `http://localhost:3000` → dashboard funzionante
- `http://localhost:6900/docs` → OpenAPI docs OpenBB

- [ ] **Step 5: Verifica end-to-end manuale**

Checklist:
- [ ] Overview: 4 watchlist cards con prezzi e sparkline
- [ ] Overview: widget macro FED e Treasury 10Y
- [ ] Azioni (AAPL): grafico prezzi, tab indicatori con RSI, tab fondamentali, tab news
- [ ] Azioni: pulsante AI disabilitato con tooltip
- [ ] Crypto: tabella top 10 con prezzi
- [ ] Macro: 5 grafici FRED caricati
- [ ] Portfolio: import CSV di test, tabella P&L, pie chart

- [ ] **Step 6: Commit finale**

```bash
git add .
git commit -m "feat: dashboard OpenBB completa — Overview, Azioni, Crypto, Macro, Portfolio"
```

---

## Note per l'implementazione

**Ordine di esecuzione consigliato:** Seguire i task nell'ordine indicato — ogni milestone dipende dalla precedente.

**Dev senza Docker:**
```bash
# Terminale 1 — backend
cd vecchio && .venv/Scripts/activate
uvicorn openbb_core.api.rest_api:app --host 127.0.0.1 --port 6900 --reload

# Terminale 2 — frontend
cd frontend && npm run dev
```

**CORS:** Se il browser blocca le chiamate a `:6900`, il `rewrites()` in `next.config.ts` le proxattraverso Next.js evitando il problema.

**Dati lenti:** yfinance può essere lento (1-3s). Normale. Il timeout a 10s in `lib/openbb.ts` gestisce i casi peggiori.
