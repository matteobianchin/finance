# Domain API Architecture Design

**Date:** 2026-04-11
**Status:** Approved

---

## Problem

The current architecture has a structural mismatch: quantitative math and data orchestration logic have ended up in the TypeScript/Next.js layer, where the ecosystem is weak, instead of Python where numpy/pandas/scipy make it trivial.

Specific problems identified:

| Location | Problem |
|---|---|
| `frontend/lib/quant.ts` | 154 lines of manual math (vol, Sharpe, drawdown, beta, correlation) — should be numpy |
| `signals/route.ts:17` | Williams %R implemented manually because not exposed by OpenBB |
| `openbb.ts:247` | Regex parsing of raw pandas_ta column names (RSI_14, MACDh_12_26_9, etc.) |
| `openbb.ts:194` | 10 parallel HTTP calls to fetch crypto top 10 |
| `obbPost` pattern | Frontend fetches OHLCV, then re-sends it to backend to compute indicators (2 trips) |
| Screener | Up to N×3 HTTP calls for 20 tickers |

---

## Solution: Domain API FastAPI Service

Add a thin Python FastAPI service between Next.js and OpenBB Platform. It imports OpenBB as a Python library (not via HTTP), handles all math with pandas/numpy/pandas_ta, and returns clean normalized JSON.

---

## Architecture

```
Browser
    ↕ fetch JSON
Next.js :3000
  - React UI (unchanged)
  - /api/analyze  (streaming AI, unchanged)
  - proxy rewrite: /api/domain → :6901
    ↕ semantic endpoints, normalized JSON
Domain API FastAPI :6901  [NEW]
  - /signals/{ticker}
  - /quant/{ticker}
  - /screener
  - /crypto/top
  - pass-through: /quote, /history, /fundamentals, /news, /earnings, /macro
    ↕ from openbb import obb  (direct library import, no HTTP)
OpenBB Platform :6900  [unchanged]
    ↕
yfinance / FMP / FRED / Tiingo
```

---

## Domain API Endpoints

### Data (pass-through + normalization)

| Endpoint | Replaces | Notes |
|---|---|---|
| `GET /quote/{ticker}` | `getQuote()` | Normalized JSON |
| `GET /history/{ticker}?timeframe=1M` | `getPriceHistory()` | |
| `GET /fundamentals/{ticker}` | `getIncomeStatement()` + `getKeyMetrics()` | Unified in one call |
| `GET /news/{ticker}` | `getNews()` | |
| `GET /earnings?symbols=AAPL,MSFT` | `getEarningsCalendar()` | Bulk, single call |
| `GET /macro/{series}` | `getFredSeries()` | |
| `GET /crypto/top` | `getCryptoTop10()` (10 calls) | Single bulk call |

### Signals

`GET /signals/{ticker}?timeframe=1M`

Internally: fetch OHLCV → pandas_ta → respond in one shot.
No `obbPost`, no `calcWilliamsR`, no regex column parsing.

Response shape:
```json
{
  "dates": ["2024-01-01", "..."],
  "closes": [150.0, "..."],
  "rsi": [{ "date": "2024-01-01", "value": 62.4 }],
  "macd_hist": [{ "date": "...", "value": 0.23 }],
  "bbands": [{ "date": "...", "upper": 160.0, "middle": 155.0, "lower": 150.0, "price": 155.0 }],
  "atr": [{ "date": "...", "value": 1.8 }],
  "stoch": [{ "date": "...", "k": 72.0, "d": 68.0 }],
  "adx": [{ "date": "...", "value": 28.0 }],
  "obv": [{ "date": "...", "value": 1234567.0 }],
  "williams_r": [{ "date": "...", "value": -22.0 }],
  "last": {
    "rsi": 62.4,
    "macd_hist": 0.23,
    "bb_upper": 160.0,
    "bb_lower": 150.0,
    "atr": 1.8,
    "stoch_k": 72.0,
    "stoch_d": 68.0,
    "price": 155.0
  }
}
```

### Quant

`GET /quant/{ticker}?timeframe=1Y&benchmark=SPY`

**Migrated from `quant.ts`:**
- Annualized volatility
- Rolling volatility (30d window)
- Sharpe ratio
- Max drawdown (value + duration)
- Drawdown series
- Beta vs benchmark
- Correlation matrix (multi-ticker)
- Return histogram

**New functions (pandas/scipy):**

| Function | Library |
|---|---|
| Sortino ratio | numpy |
| VaR 95% / 99% | numpy.percentile |
| CVaR (Expected Shortfall) | numpy |
| Rolling beta (30d) | pandas rolling |
| Rolling Sharpe | pandas rolling |
| Skewness / Kurtosis | scipy.stats |
| Calmar ratio | numpy |

### Screener

`GET /screener?symbols=AAPL,MSFT,...`

Fetches quote + RSI + 1M return for all tickers in parallel via `asyncio.gather` internally. Returns array ready for client-side `filterRows`/`sortRows` (these remain in TypeScript — they are pure UI filtering logic, correct in TS).

---

## Frontend Changes

### Files deleted
- `frontend/lib/quant.ts` — all math moves to Python
- `calcWilliamsR` function in `frontend/app/api/signals/route.ts`

### Files modified
- `frontend/lib/openbb.ts` — proxy target changes from `:6900` to `:6901`; `obbPost` and regex helpers removed; new semantic endpoint functions added
- `frontend/app/api/signals/route.ts` — simplified to a thin call to `GET /signals/{ticker}`
- `frontend/next.config.mjs` — proxy rewrite updated to point to Domain API

### Files unchanged
- All React components
- `frontend/lib/screener.ts` (`filterRows`/`sortRows` — correct in TS)
- `frontend/lib/portfolio.ts` (out of scope)
- `frontend/app/api/analyze/route.ts` (streaming AI stays in Next.js)
- `frontend/components/providers/WatchlistProvider.tsx`
- All hooks

---

## New Directory Structure

```
backend/
  domain_api/
    main.py
    routers/
      signals.py      ← technical indicators via pandas_ta
      quant.py        ← financial math via numpy/scipy
      screener.py     ← bulk screener
      crypto.py       ← top 10 bulk quotes
      data.py         ← pass-through: quote/history/fundamentals/news/earnings/macro
    requirements.txt
    tests/
      test_signals.py
      test_quant.py
      test_screener.py
```

---

## Environment Variables

### `frontend/.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:6900          # unchanged
OPENBB_INTERNAL_URL=http://localhost:6900          # unchanged
DOMAIN_API_URL=http://localhost:6901               # NEW — used by Route Handlers server-side
ANTHROPIC_API_KEY=sk-ant-...                       # unchanged
```
Note: the browser never calls Domain API directly — it always goes through the Next.js proxy rewrite (`/api/domain → :6901`). No `NEXT_PUBLIC_DOMAIN_API_URL` needed.

### `backend/domain_api/.env`
```env
OPENBB_BACKEND_URL=http://localhost:6900
PORT=6901
```

---

## docker-compose

```yaml
services:
  backend:       # unchanged, port 6900
    ...
  domain-api:    # NEW
    build: ./backend/domain_api
    ports: ["6901:6901"]
    depends_on: [backend]
    environment:
      OPENBB_BACKEND_URL: http://backend:6900
  frontend:      # unchanged port 3000, new env vars
    environment:
      DOMAIN_API_URL: http://domain-api:6901
      NEXT_PUBLIC_DOMAIN_API_URL: http://domain-api:6901
```

---

## Test Strategy

### Domain API (pytest)
```
backend/domain_api/tests/
  test_signals.py    ← mock obb, verify output JSON structure and all indicator keys present
  test_quant.py      ← mathematical tests with known series (e.g. Sharpe on constant series = 0, VaR on normal distribution)
  test_screener.py   ← mock bulk quotes, verify aggregation
```

### Frontend (Vitest)
- `__tests__/lib/quant.test.ts` — **deleted** (28 tests removed, math is now Python's responsibility)
- `__tests__/lib/openbb.test.ts` — rewritten: mock fetch for new semantic endpoints (`/signals/`, `/quant/`, `/screener`); remove all `obbPost` and regex-related test cases
- `__tests__/lib/portfolio.test.ts` — unchanged
- `__tests__/components/WatchlistManager.test.tsx` — unchanged

---

## Out of Scope

- `frontend/lib/portfolio.ts` — P&L calculations remain in TypeScript for now
- Portfolio historical value chart — remains as-is
- Any changes to OpenBB Platform internals
