# Remove OpenBB Platform Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove OpenBB Platform (:6900) entirely; Domain API (:6901) calls yfinance, FMP, Tiingo, and FRED directly.

**Architecture:** New `fetcher.py` replaces `client.py` as the yfinance access layer (history + quote). `data.py` is fully rewritten using `fetcher.py` + httpx (FMP, Tiingo) + fredapi (FRED). All 5 routers swap `from client import` → `from fetcher import`.

**Tech Stack:** yfinance ≥ 0.2.40, fredapi ≥ 0.5.0, python-dotenv ≥ 1.0.0, httpx (already present), pandas/numpy (already present)

---

## File Map

| Action | File |
|--------|------|
| Create | `backend/domain_api/fetcher.py` |
| Rewrite | `backend/domain_api/routers/data.py` |
| Modify | `backend/domain_api/routers/signals.py` |
| Modify | `backend/domain_api/routers/quant.py` |
| Modify | `backend/domain_api/routers/advanced.py` |
| Modify | `backend/domain_api/routers/screener.py` |
| Modify | `backend/domain_api/requirements.txt` |
| Modify | `backend/domain_api/main.py` |
| Create | `backend/domain_api/.env` (git-ignored) |
| Modify | `docker-compose.yml` |
| Delete | `backend/Dockerfile.api` |
| Delete | `backend/domain_api/client.py` |
| Modify | `CLAUDE.md` |

---

## Task 1: API keys + requirements + dotenv

**Files:**
- Modify: `backend/domain_api/requirements.txt`
- Create: `backend/domain_api/.env`
- Modify: `backend/domain_api/main.py`

- [ ] **Step 1: Update requirements.txt**

Replace the entire file content:
```
fastapi>=0.115.0
uvicorn[standard]>=0.30.6
httpx>=0.27.0
pandas>=2.2.3,<3.0
numpy>=1.26.4,<3.0
scipy>=1.14.0
statsmodels>=0.14.0
pydantic>=2.9.0
yfinance>=0.2.40
fredapi>=0.5.0
python-dotenv>=1.0.0
```

- [ ] **Step 2: Install new packages**

```bash
cd backend/domain_api
pip install yfinance>=0.2.40 fredapi>=0.5.0 python-dotenv>=1.0.0
```

Expected: no errors.

- [ ] **Step 3: Create `backend/domain_api/.env`**

Open `backend/user_settings.json` and copy the values for `fmp_api_key`, `fred_api_key`, `tiingo_token`. Create the file:

```env
FMP_API_KEY=<value of fmp_api_key from user_settings.json>
TIINGO_API_KEY=<value of tiingo_token from user_settings.json>
FRED_API_KEY=<value of fred_api_key from user_settings.json>
```

This file is git-ignored (`.env` pattern in root `.gitignore`).

- [ ] **Step 4: Add `load_dotenv()` to `main.py`**

Replace the entire `backend/domain_api/main.py`:
```python
import os
from dotenv import load_dotenv
from fastapi import FastAPI
from routers import data, signals, quant, screener, advanced

load_dotenv()  # loads backend/domain_api/.env in development

app = FastAPI(title="OpenBB Domain API", version="1.0.0")

app.include_router(data.router)
app.include_router(signals.router)
app.include_router(quant.router)
app.include_router(screener.router)
app.include_router(advanced.router)

@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 5: Commit**

```bash
git add backend/domain_api/requirements.txt backend/domain_api/main.py
git commit -m "chore: add yfinance, fredapi, python-dotenv; load_dotenv in main.py"
```

---

## Task 2: Create `fetcher.py`

**Files:**
- Create: `backend/domain_api/fetcher.py`

- [ ] **Step 1: Create the file**

```python
"""
fetcher.py — Direct yfinance data access layer.

Replaces client.py (OpenBB HTTP proxy). All public functions are async
wrappers around synchronous yfinance calls via run_in_executor so they
integrate cleanly with FastAPI's async event loop.
"""

import asyncio
from datetime import date, timedelta

import pandas as pd
import yfinance as yf

TIMEFRAME_DAYS: dict[str, int] = {
    "1D": 2, "1W": 7, "1M": 30, "3M": 90,
    "6M": 180, "1Y": 365, "5Y": 1825,
}


def timeframe_start(timeframe: str) -> str:
    """Return ISO date string for the start of the given timeframe."""
    days = TIMEFRAME_DAYS.get(timeframe, 30)
    return (date.today() - timedelta(days=days)).isoformat()


# ── History ───────────────────────────────────────────────────────────────────

def _fetch_history_sync(ticker: str, start_date: str, interval: str) -> list[dict]:
    df = yf.Ticker(ticker).history(start=start_date, interval=interval, auto_adjust=True)
    if df.empty:
        return []
    df = df.reset_index()
    df.columns = [c.lower() for c in df.columns]
    # Intraday index column is named 'datetime'; daily is 'date'
    if "datetime" in df.columns:
        df = df.rename(columns={"datetime": "date"})
    fmt = "%Y-%m-%dT%H:%M:%S" if interval != "1d" else "%Y-%m-%d"
    df["date"] = df["date"].dt.strftime(fmt)
    keep = [c for c in ["date", "open", "high", "low", "close", "volume"] if c in df.columns]
    return df[keep].to_dict(orient="records")


async def fetch_history(ticker: str, start_date: str, interval: str = "1d") -> list[dict]:
    """
    Fetch OHLCV bars from yfinance.

    Returns list of dicts with lowercase keys: date, open, high, low, close, volume.
    date is a string: 'YYYY-MM-DD' (daily) or 'YYYY-MM-DDTHH:MM:SS' (intraday).
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _fetch_history_sync, ticker, start_date, interval)


# ── Quote ─────────────────────────────────────────────────────────────────────

def _fetch_quote_sync(ticker: str) -> dict | None:
    info = yf.Ticker(ticker).info
    if not info or "symbol" not in info:
        return None
    price = info.get("currentPrice") or info.get("regularMarketPrice") or 0.0
    change = info.get("regularMarketChange") or 0.0
    # regularMarketChangePercent from yfinance is in decimal form (-0.025 = -2.5%)
    change_pct = (info.get("regularMarketChangePercent") or 0.0) * 100
    return {
        "symbol": info.get("symbol", ticker.upper()),
        "name": info.get("longName") or info.get("shortName", ""),
        "price": float(price),
        "day_change": float(change),
        "day_change_percent": float(change_pct),
        "volume": info.get("regularMarketVolume"),
        "market_cap": info.get("marketCap"),
        "pe_ratio": info.get("trailingPE"),
    }


async def fetch_quote(ticker: str) -> dict | None:
    """
    Fetch current quote from yfinance.

    Returns dict matching the Quote interface, or None if ticker not found.
    Fields: symbol, name, price, day_change, day_change_percent, volume, market_cap, pe_ratio.
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _fetch_quote_sync, ticker)
```

- [ ] **Step 2: Smoke test `fetch_history`**

```bash
cd backend/domain_api
python -c "
import asyncio
from fetcher import fetch_history, fetch_quote, timeframe_start
bars = asyncio.run(fetch_history('AAPL', timeframe_start('1M')))
print(f'bars: {len(bars)}, first: {bars[0]}')
"
```

Expected output (example):
```
bars: 22, first: {'date': '2026-03-12', 'open': 213.5, 'high': 215.2, 'low': 212.1, 'close': 214.8, 'volume': 58000000}
```

- [ ] **Step 3: Smoke test `fetch_quote`**

```bash
cd backend/domain_api
python -c "
import asyncio
from fetcher import fetch_quote
q = asyncio.run(fetch_quote('AAPL'))
print(q)
"
```

Expected: dict with `price` (float ~200), `day_change_percent` (float, e.g. -1.2 or +0.8).

> **If `day_change_percent` is a tiny decimal** (e.g., -0.012 instead of -1.2): remove the `* 100` multiplier from `_fetch_quote_sync`. Some yfinance versions return it already as percentage.

- [ ] **Step 4: Commit**

```bash
git add backend/domain_api/fetcher.py
git commit -m "feat: add fetcher.py — direct yfinance history and quote"
```

---

## Task 3: Update `signals.py`, `quant.py`, `advanced.py`

These three routers only use `obb_get("equity/price/historical", ...)` and `timeframe_start` from `client.py`.

**Files:**
- Modify: `backend/domain_api/routers/signals.py`
- Modify: `backend/domain_api/routers/quant.py`
- Modify: `backend/domain_api/routers/advanced.py`

- [ ] **Step 1: Update `signals.py` import (line 4)**

Replace:
```python
from client import obb_get, timeframe_start
```
With:
```python
from fetcher import fetch_history, timeframe_start
```

- [ ] **Step 2: Update `signals.py` route handler (lines 206-221)**

Replace:
```python
@router.get("/signals/{ticker}")
async def signals(ticker: str, timeframe: str = "1M"):
    params: dict = {
        "symbol": ticker,
        "provider": "yfinance",
        "start_date": timeframe_start(timeframe),
    }
    if timeframe == "1D":
        params["interval"] = "5m"

    bars = await obb_get("equity/price/historical", params)
    if len(bars) < 2:
        raise HTTPException(status_code=422, detail="Insufficient data")

    df = _bars_to_df(bars)
    return compute_signals(df)
```
With:
```python
@router.get("/signals/{ticker}")
async def signals(ticker: str, timeframe: str = "1M"):
    interval = "5m" if timeframe == "1D" else "1d"
    bars = await fetch_history(ticker, timeframe_start(timeframe), interval=interval)
    if len(bars) < 2:
        raise HTTPException(status_code=422, detail="Insufficient data")
    df = _bars_to_df(bars)
    return compute_signals(df)
```

- [ ] **Step 3: Update `quant.py` import (line 5)**

Replace:
```python
from client import obb_get, timeframe_start
```
With:
```python
from fetcher import fetch_history, timeframe_start
```

- [ ] **Step 4: Update `quant.py` route handler (lines 226-249)**

Replace:
```python
@router.get("/quant/{ticker}")
async def quant(ticker: str, timeframe: str = "1Y", benchmark: str = "SPY"):
    params = {"symbol": ticker, "provider": "yfinance",
              "start_date": timeframe_start(timeframe)}
    bench_params = {"symbol": benchmark, "provider": "yfinance",
                    "start_date": timeframe_start(timeframe)}

    bars_res, bench_res = await asyncio.gather(
        obb_get("equity/price/historical", params),
        obb_get("equity/price/historical", bench_params),
        return_exceptions=True,
    )

    if isinstance(bars_res, Exception) or len(bars_res) < 20:
        raise HTTPException(status_code=422, detail="Insufficient data")

    closes = np.array([float(b["close"]) for b in bars_res])
    dates  = [str(b["date"])[:10] for b in bars_res]

    bench_closes = None
    if not isinstance(bench_res, Exception) and len(bench_res) >= 20:
        bench_closes = np.array([float(b["close"]) for b in bench_res])

    return compute_quant(closes, bench_closes, dates, timeframe)
```
With:
```python
@router.get("/quant/{ticker}")
async def quant(ticker: str, timeframe: str = "1Y", benchmark: str = "SPY"):
    start = timeframe_start(timeframe)
    bars_res, bench_res = await asyncio.gather(
        fetch_history(ticker, start),
        fetch_history(benchmark, start),
        return_exceptions=True,
    )

    if isinstance(bars_res, Exception) or len(bars_res) < 20:
        raise HTTPException(status_code=422, detail="Insufficient data")

    closes = np.array([float(b["close"]) for b in bars_res])
    dates  = [str(b["date"])[:10] for b in bars_res]

    bench_closes = None
    if not isinstance(bench_res, Exception) and len(bench_res) >= 20:
        bench_closes = np.array([float(b["close"]) for b in bench_res])

    return compute_quant(closes, bench_closes, dates, timeframe)
```

- [ ] **Step 5: Update `advanced.py` import (line 4)**

Replace:
```python
from client import obb_get, timeframe_start
```
With:
```python
from fetcher import fetch_history, timeframe_start
```

- [ ] **Step 6: Update `advanced.py` `/advanced/{ticker}` handler (lines 17-26)**

Replace:
```python
@router.get("/advanced/{ticker}")
async def advanced(ticker: str, timeframe: str = "1Y"):
    params = {
        "symbol": ticker,
        "provider": "yfinance",
        "start_date": timeframe_start(timeframe),
    }
    bars = await obb_get("equity/price/historical", params)
    if isinstance(bars, Exception) or len(bars) < 30:
        raise HTTPException(status_code=422, detail="Insufficient data")
```
With:
```python
@router.get("/advanced/{ticker}")
async def advanced(ticker: str, timeframe: str = "1Y"):
    bars = await fetch_history(ticker, timeframe_start(timeframe))
    if len(bars) < 30:
        raise HTTPException(status_code=422, detail="Insufficient data")
```

- [ ] **Step 7: Update `advanced.py` `/portfolio/optimize` handler (lines 80-98)**

Replace:
```python
    start = timeframe_start(timeframe)
    tasks = [
        obb_get("equity/price/historical", {
            "symbol": t, "provider": "yfinance", "start_date": start,
        })
        for t in tickers
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
```
With:
```python
    start = timeframe_start(timeframe)
    tasks = [fetch_history(t, start) for t in tickers]
    results = await asyncio.gather(*tasks, return_exceptions=True)
```

- [ ] **Step 8: Run pytest**

```bash
cd backend/domain_api
pytest tests/ -v
```

Expected: `16 passed` (tests cover pure math functions, not HTTP calls).

- [ ] **Step 9: Commit**

```bash
git add backend/domain_api/routers/signals.py backend/domain_api/routers/quant.py backend/domain_api/routers/advanced.py
git commit -m "refactor: signals, quant, advanced use fetcher.py instead of client.py"
```

---

## Task 4: Update `screener.py`

**Files:**
- Modify: `backend/domain_api/routers/screener.py`

- [ ] **Step 1: Update import (line 5)**

Replace:
```python
from client import obb_get, timeframe_start
```
With:
```python
from fetcher import fetch_history, fetch_quote, timeframe_start
```

- [ ] **Step 2: Replace `_fetch_ticker` (lines 32-62)**

Replace the entire function:
```python
async def _fetch_ticker(ticker: str) -> dict | None:
    try:
        quote_res, hist_res = await asyncio.gather(
            obb_get("equity/price/quote", {"symbol": ticker, "provider": "yfinance"}),
            obb_get("equity/price/historical", {
                "symbol": ticker,
                "provider": "yfinance",
                "start_date": timeframe_start("1M"),
            }),
            return_exceptions=True,
        )

        if isinstance(quote_res, Exception) or not quote_res:
            return None

        quote = quote_res[0]
        rsi_val: float | None = None
        return_1m: float | None = None

        if not isinstance(hist_res, Exception) and len(hist_res) >= 15:
            df = pd.DataFrame(hist_res)
            df["close"] = pd.to_numeric(df["close"], errors="coerce")
            rsi_series = calc_rsi(df["close"], length=14).dropna()
            rsi_val = float(rsi_series.iloc[-1]) if len(rsi_series) > 0 else None
            closes = df["close"].dropna().values
            if len(closes) >= 2:
                return_1m = float((closes[-1] - closes[0]) / closes[0] * 100)

        return _build_screener_row(ticker, quote, rsi_val, return_1m)
    except Exception:
        return None
```
With:
```python
async def _fetch_ticker(ticker: str) -> dict | None:
    try:
        quote, hist_res = await asyncio.gather(
            fetch_quote(ticker),
            fetch_history(ticker, timeframe_start("1M")),
            return_exceptions=True,
        )

        if isinstance(quote, Exception) or not quote:
            return None

        rsi_val: float | None = None
        return_1m: float | None = None

        if not isinstance(hist_res, Exception) and len(hist_res) >= 15:
            df = pd.DataFrame(hist_res)
            df["close"] = pd.to_numeric(df["close"], errors="coerce")
            rsi_series = calc_rsi(df["close"], length=14).dropna()
            rsi_val = float(rsi_series.iloc[-1]) if len(rsi_series) > 0 else None
            closes = df["close"].dropna().values
            if len(closes) >= 2:
                return_1m = float((closes[-1] - closes[0]) / closes[0] * 100)

        return _build_screener_row(ticker, quote, rsi_val, return_1m)
    except Exception:
        return None
```

- [ ] **Step 3: Replace `crypto_top` inner function (lines 72-80)**

Replace:
```python
    async def _fetch_crypto(symbol: str) -> dict | None:
        try:
            results = await obb_get("equity/price/quote",
                                    {"symbol": symbol, "provider": "yfinance"})
            return results[0] if results else None
        except Exception:
            return None
```
With:
```python
    async def _fetch_crypto(symbol: str) -> dict | None:
        try:
            return await fetch_quote(symbol)
        except Exception:
            return None
```

- [ ] **Step 4: Run pytest**

```bash
cd backend/domain_api
pytest tests/ -v
```

Expected: `16 passed`.

- [ ] **Step 5: Commit**

```bash
git add backend/domain_api/routers/screener.py
git commit -m "refactor: screener uses fetch_quote and fetch_history from fetcher.py"
```

---

## Task 5: Rewrite `data.py`

**Files:**
- Rewrite: `backend/domain_api/routers/data.py`

- [ ] **Step 1: Replace entire `data.py`**

```python
"""
data.py — Domain API data endpoints.

Calls providers directly: yfinance (via fetcher.py), FMP REST API,
Tiingo REST API, FRED (via fredapi). No OpenBB Platform required.
"""

import asyncio
import os
from datetime import date, timedelta

import httpx
import pandas as pd
import yfinance as yf
from fastapi import APIRouter, HTTPException

from fetcher import fetch_history, fetch_quote, timeframe_start

router = APIRouter()

FMP_API_KEY = os.getenv("FMP_API_KEY", "")
TIINGO_API_KEY = os.getenv("TIINGO_API_KEY", "")
FRED_API_KEY = os.getenv("FRED_API_KEY", "")
FMP_BASE = "https://financialmodelingprep.com/api/v3"
TIINGO_BASE = "https://api.tiingo.com"


# ── /quote/{ticker} ────────────────────────────────────────────────────────────

@router.get("/quote/{ticker}")
async def quote(ticker: str):
    result = await fetch_quote(ticker)
    if not result:
        raise HTTPException(status_code=404, detail="No quote found")
    return result


# ── /history/{ticker} ─────────────────────────────────────────────────────────

@router.get("/history/{ticker}")
async def history(ticker: str, timeframe: str = "1M"):
    interval = "5m" if timeframe == "1D" else "1d"
    return await fetch_history(ticker, timeframe_start(timeframe), interval=interval)


# ── /fundamentals/{ticker} ────────────────────────────────────────────────────

def _parse_income(data: list) -> list:
    return [
        {
            "date": r.get("date", ""),
            "period": r.get("period", ""),
            "revenue": r.get("revenue"),
            "net_income": r.get("netIncome"),
            "eps": r.get("eps"),
            "ebitda": r.get("ebitda"),
            "gross_profit": r.get("grossProfit"),
        }
        for r in data
    ]


def _parse_metrics(data: list) -> list:
    return [
        {
            "date": r.get("date", ""),
            "pe_ratio": r.get("peRatio"),
            "price_to_book": r.get("pbRatio"),
            "price_to_sales": r.get("priceToSalesRatio"),
            "debt_to_equity": r.get("debtToEquity"),
            "return_on_equity": r.get("roe"),
        }
        for r in data
    ]


@router.get("/fundamentals/{ticker}")
async def fundamentals(ticker: str):
    async with httpx.AsyncClient(timeout=15.0) as client:
        income_res, metrics_res = await asyncio.gather(
            client.get(
                f"{FMP_BASE}/income-statement/{ticker}",
                params={"apikey": FMP_API_KEY, "period": "annual", "limit": 5},
            ),
            client.get(
                f"{FMP_BASE}/key-metrics/{ticker}",
                params={"apikey": FMP_API_KEY, "period": "annual", "limit": 5},
            ),
            return_exceptions=True,
        )
    income = _parse_income(income_res.json() if not isinstance(income_res, Exception) else [])
    metrics = _parse_metrics(metrics_res.json() if not isinstance(metrics_res, Exception) else [])
    return {"income": income, "metrics": metrics}


# ── /news/{ticker} ────────────────────────────────────────────────────────────

@router.get("/news/{ticker}")
async def news(ticker: str):
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(
            f"{TIINGO_BASE}/tiingo/news",
            params={"tickers": ticker, "limit": 10, "token": TIINGO_API_KEY},
        )
        r.raise_for_status()
    return [
        {
            "date": a.get("publishedDate", "")[:10],
            "title": a.get("title", ""),
            "text": a.get("description", ""),
            "url": a.get("url", ""),
            "source": a.get("source", ""),
            "symbols": a.get("tickers", []),
        }
        for a in r.json()
    ]


# ── /earnings ─────────────────────────────────────────────────────────────────

def _fetch_earnings_sync(ticker: str) -> list[dict]:
    t = yf.Ticker(ticker)
    cal = t.calendar
    if not cal or "Earnings Date" not in cal:
        return []
    dates = cal["Earnings Date"]
    if not isinstance(dates, list):
        dates = [dates]
    return [
        {
            "symbol": ticker.upper(),
            "date": str(d)[:10],
            "eps_estimate": cal.get("Earnings Average"),
            "eps_actual": None,
            "revenue_estimate": cal.get("Revenue Average"),
            "revenue_actual": None,
        }
        for d in dates
    ]


@router.get("/earnings")
async def earnings(symbols: str):
    tickers = [s.strip() for s in symbols.split(",") if s.strip()]
    loop = asyncio.get_event_loop()
    results = await asyncio.gather(
        *[loop.run_in_executor(None, _fetch_earnings_sync, t) for t in tickers],
        return_exceptions=True,
    )
    return [item for r in results if not isinstance(r, Exception) for item in r]


# ── /macro/{series_id} ────────────────────────────────────────────────────────

def _fetch_macro_sync(series_id: str, start: str) -> list[dict]:
    import fredapi
    fred = fredapi.Fred(api_key=FRED_API_KEY)
    series = fred.get_series(series_id, observation_start=start)
    return [
        {"date": str(idx)[:10], "value": float(v) if pd.notna(v) else None}
        for idx, v in series.items()
    ]


@router.get("/macro/{series_id}")
async def macro(series_id: str, start_date: str | None = None):
    start = start_date or (date.today() - timedelta(days=365 * 5)).isoformat()
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _fetch_macro_sync, series_id, start)


# ── /search ───────────────────────────────────────────────────────────────────

def _search_sync(query: str) -> list[dict]:
    results = yf.Search(query, max_results=10).quotes
    return [
        {
            "symbol": r.get("symbol", ""),
            "name": r.get("longname") or r.get("shortname", ""),
            "exchange": r.get("exchange", ""),
            "currency": r.get("currency", ""),
            "security_type": r.get("quoteType", ""),
        }
        for r in results
        if r.get("symbol")
    ]


@router.get("/search")
async def search(query: str):
    if not query.strip():
        return []
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _search_sync, query)
```

- [ ] **Step 2: Run pytest**

```bash
cd backend/domain_api
pytest tests/ -v
```

Expected: `16 passed`.

- [ ] **Step 3: Commit**

```bash
git add backend/domain_api/routers/data.py
git commit -m "feat: rewrite data.py with direct provider calls (yfinance, FMP, Tiingo, FRED)"
```

---

## Task 6: Infrastructure — docker-compose + Dockerfile + CLAUDE.md

**Files:**
- Modify: `docker-compose.yml`
- Delete: `backend/Dockerfile.api`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Rewrite `docker-compose.yml`**

Replace the entire file:
```yaml
services:
  domain-api:
    build:
      context: ./backend/domain_api
      dockerfile: Dockerfile
    ports:
      - "6901:6901"
    environment:
      FMP_API_KEY: ${FMP_API_KEY}
      TIINGO_API_KEY: ${TIINGO_API_KEY}
      FRED_API_KEY: ${FRED_API_KEY}
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      args:
        - DOMAIN_API_URL=http://domain-api:6901
    ports:
      - "3000:3000"
    environment:
      - DOMAIN_API_URL=http://domain-api:6901
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    depends_on:
      - domain-api
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
```

> **Note:** `NEXT_PUBLIC_API_URL` and `OPENBB_INTERNAL_URL` are removed. The `/api/analyze` Route Handler (AI analysis) uses `OPENBB_INTERNAL_URL` to call OpenBB — this will stop working in Docker after this change. Add it as a follow-up task: migrate `/api/analyze` to call Domain API endpoints for data.

- [ ] **Step 2: Delete `backend/Dockerfile.api`**

```bash
git rm backend/Dockerfile.api
```

- [ ] **Step 3: Update `CLAUDE.md` — Avvio section**

Find the "Sviluppo locale" section and replace it with:

```markdown
### Sviluppo locale

```bash
# Terminale 1 — Domain API
cd backend/domain_api
cp .env.example .env  # oppure crea manualmente con FMP/TIINGO/FRED keys
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 6901 --reload

# Terminale 2 — Frontend
cd frontend
cp .env.example .env.local
npm install
npm run dev
```
```

Also update the architecture section: change `3 servizi Docker` → `2 servizi Docker` and remove references to OpenBB Platform `:6900`.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml CLAUDE.md
git commit -m "chore: remove OpenBB Platform service from docker-compose, update CLAUDE.md"
```

---

## Task 7: Delete `client.py` + final verification

**Files:**
- Delete: `backend/domain_api/client.py`

- [ ] **Step 1: Verify no more imports of `client`**

```bash
grep -r "from client import" backend/domain_api/
```

Expected: no output (zero matches).

- [ ] **Step 2: Delete `client.py`**

```bash
git rm backend/domain_api/client.py
```

- [ ] **Step 3: Run pytest**

```bash
cd backend/domain_api
pytest tests/ -v
```

Expected: `16 passed`.

- [ ] **Step 4: Start Domain API and run manual verification**

```bash
cd backend/domain_api
uvicorn main:app --host 127.0.0.1 --port 6901 --reload
```

In a second terminal, run each check:

```bash
# Quote
curl -s http://localhost:6901/quote/AAPL | python -m json.tool
# Expected: {"symbol": "AAPL", "price": <float>, "day_change_percent": <float>, ...}

# History
curl -s "http://localhost:6901/history/AAPL?timeframe=1M" | python -m json.tool | head -20
# Expected: [{"date": "2026-...", "open": ..., "close": ..., ...}, ...]

# Fundamentals
curl -s http://localhost:6901/fundamentals/AAPL | python -m json.tool
# Expected: {"income": [...], "metrics": [...]}

# News
curl -s http://localhost:6901/news/AAPL | python -m json.tool
# Expected: [{"date": "...", "title": "...", "url": "...", ...}, ...]

# Earnings
curl -s "http://localhost:6901/earnings?symbols=AAPL,MSFT" | python -m json.tool
# Expected: [{"symbol": "AAPL", "date": "...", ...}, ...]

# Macro
curl -s http://localhost:6901/macro/DFF | python -m json.tool | tail -10
# Expected: [..., {"date": "2026-...", "value": <float>}]

# Search
curl -s "http://localhost:6901/search?query=apple" | python -m json.tool
# Expected: [{"symbol": "AAPL", "name": "Apple Inc.", ...}, ...]
```

- [ ] **Step 5: Verify signals endpoint still works (uses fetcher.py)**

```bash
curl -s "http://localhost:6901/signals/AAPL?timeframe=1M" | python -m json.tool | python -c "import sys,json; d=json.load(sys.stdin); print('rsi last:', d['last']['rsi'])"
# Expected: rsi last: <float between 0 and 100>
```

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "refactor: remove client.py — OpenBB Platform fully eliminated"
```

---

## Known Gap: AI Analysis in Docker

`/api/analyze` (Next.js Route Handler) fetches data via `OPENBB_INTERNAL_URL=http://backend:6900`.
After this migration, that service no longer exists in Docker.

**In development (localhost):** AI analysis continues to work if OpenBB Platform is still running locally.

**Follow-up task (out of scope):** Update `/api/analyze` to call Domain API endpoints (`/quote`, `/history`, `/fundamentals`, `/news`) instead of OpenBB Platform directly.
