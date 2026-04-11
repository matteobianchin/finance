# Domain API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a Python FastAPI Domain API service (:6901) between Next.js and OpenBB Platform, moving all quant math and data orchestration from TypeScript to Python.

**Architecture:** A new FastAPI service calls OpenBB (:6900) via HTTP for raw data, then applies pandas/numpy/scipy/pandas_ta for all computation, and returns clean normalized JSON. Next.js becomes a thin UI layer. `quant.ts` is deleted entirely.

**Tech Stack:** Python 3.11+, FastAPI, httpx, pandas, numpy, scipy, pandas_ta; TypeScript/Next.js 14 (frontend unchanged except wiring).

---

## File Map

### New files (Domain API)
- `backend/domain_api/main.py` — FastAPI app entry point, router registration
- `backend/domain_api/client.py` — httpx wrapper + timeframe utilities
- `backend/domain_api/requirements.txt` — Python dependencies
- `backend/domain_api/Dockerfile` — container definition
- `backend/domain_api/routers/__init__.py` — empty
- `backend/domain_api/routers/data.py` — pass-through: quote, history, fundamentals, news, earnings, macro
- `backend/domain_api/routers/signals.py` — all technical indicators in one endpoint
- `backend/domain_api/routers/quant.py` — financial math (vol, Sharpe, drawdown, VaR, etc.)
- `backend/domain_api/routers/screener.py` — bulk screener + crypto top
- `backend/domain_api/tests/__init__.py` — empty
- `backend/domain_api/tests/test_quant.py` — math tests with known series
- `backend/domain_api/tests/test_signals.py` — signals shape/key tests
- `backend/domain_api/tests/test_screener.py` — screener aggregation tests

### Modified files
- `docker-compose.yml` — add domain-api service
- `frontend/.env.example` — add DOMAIN_API_URL
- `frontend/next.config.mjs` — add `/api/domain/*` proxy rewrite
- `frontend/types/openbb.ts` — update SignalsResult (snake_case), add QuantResult; remove TechnicalRow, BBandsBar, OBBResponse
- `frontend/lib/openbb.ts` — replace obbPost/regex helpers with clean domain fetch functions
- `frontend/app/api/signals/route.ts` — thin proxy to Domain API
- `frontend/components/equity/SignalsPanel.tsx` — update field refs to snake_case
- `frontend/app/analisi/page.tsx` — replace quant.ts imports with getQuant() call
- `frontend/components/analisi/VolatilityChart.tsx` — props: `{closes,dates}` → `{data:{date,value}[]}`
- `frontend/components/analisi/DrawdownChart.tsx` — props → `{data,maxDrawdown,durationDays}`
- `frontend/components/analisi/ReturnsHistogram.tsx` — props → `{histogram,skewness,kurtosis}`
- `frontend/components/analisi/CorrelationHeatmap.tsx` — inline pearsonCorrelation (remove quant.ts dep)
- `frontend/app/screener/page.tsx` — replace N×3 calls with getScreenerData()
- `frontend/__tests__/lib/openbb.test.ts` — remove obbPost tests, add domain endpoint tests

### Deleted files
- `frontend/lib/quant.ts`
- `frontend/__tests__/lib/quant.test.ts`

---

## Task 1: Bootstrap Domain API

**Files:**
- Create: `backend/domain_api/requirements.txt`
- Create: `backend/domain_api/Dockerfile`
- Create: `backend/domain_api/main.py`
- Create: `backend/domain_api/routers/__init__.py`
- Create: `backend/domain_api/tests/__init__.py`

- [ ] **Step 1: Create requirements.txt**

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
httpx==0.27.2
pandas==2.2.3
numpy==1.26.4
scipy==1.14.1
pandas_ta==0.3.14b0
pydantic==2.9.2
```

- [ ] **Step 2: Create Dockerfile**

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 6901
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "6901"]
```

- [ ] **Step 3: Create main.py**

```python
import os
from fastapi import FastAPI
from routers import data, signals, quant, screener

app = FastAPI(title="OpenBB Domain API", version="1.0.0")

app.include_router(data.router)
app.include_router(signals.router)
app.include_router(quant.router)
app.include_router(screener.router)

@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 4: Create routers/__init__.py and tests/__init__.py**

Both files are empty. Just `touch` them.

- [ ] **Step 5: Verify the app starts locally**

```bash
cd backend/domain_api
pip install -r requirements.txt
uvicorn main:app --port 6901 --reload
# Expected: Uvicorn running on http://127.0.0.1:6901
# GET http://localhost:6901/health → {"status":"ok"}
```

- [ ] **Step 6: Commit**

```bash
git add backend/domain_api/
git commit -m "feat: bootstrap Domain API FastAPI service"
```

---

## Task 2: Shared client utility

**Files:**
- Create: `backend/domain_api/client.py`

- [ ] **Step 1: Create client.py**

```python
import os
import httpx
from datetime import date, timedelta

OPENBB_URL = os.getenv("OPENBB_BACKEND_URL", "http://localhost:6900")

TIMEFRAME_DAYS: dict[str, int] = {
    "1D": 2, "1W": 7, "1M": 30, "3M": 90,
    "6M": 180, "1Y": 365, "5Y": 1825,
}

def timeframe_start(timeframe: str) -> str:
    days = TIMEFRAME_DAYS.get(timeframe, 30)
    return (date.today() - timedelta(days=days)).isoformat()

async def obb_get(path: str, params: dict) -> list:
    """Fetch from OpenBB REST API, unwrap {results:[...]} envelope."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(f"{OPENBB_URL}/api/v1/{path}", params=params)
        r.raise_for_status()
        return r.json().get("results", [])
```

- [ ] **Step 2: Verify import from a Python shell**

```bash
cd backend/domain_api
python -c "from client import timeframe_start, obb_get; print(timeframe_start('1M'))"
# Expected: prints a date string like 2026-03-12
```

- [ ] **Step 3: Commit**

```bash
git add backend/domain_api/client.py
git commit -m "feat: add Domain API shared OpenBB client utility"
```

---

## Task 3: Data router (pass-through endpoints)

**Files:**
- Create: `backend/domain_api/routers/data.py`

- [ ] **Step 1: Create routers/data.py**

```python
import asyncio
from datetime import date, timedelta
from fastapi import APIRouter, HTTPException
from client import obb_get, timeframe_start

router = APIRouter()

@router.get("/quote/{ticker}")
async def quote(ticker: str):
    results = await obb_get("equity/price/quote", {"symbol": ticker, "provider": "yfinance"})
    if not results:
        raise HTTPException(status_code=404, detail="No quote found")
    return results[0]

@router.get("/history/{ticker}")
async def history(ticker: str, timeframe: str = "1M"):
    params: dict = {
        "symbol": ticker,
        "provider": "yfinance",
        "start_date": timeframe_start(timeframe),
    }
    if timeframe == "1D":
        params["interval"] = "5m"
    return await obb_get("equity/price/historical", params)

@router.get("/fundamentals/{ticker}")
async def fundamentals(ticker: str):
    income_coro = obb_get("equity/fundamental/income", {
        "symbol": ticker, "provider": "fmp", "period": "annual", "limit": "5",
    })
    metrics_coro = obb_get("equity/fundamental/metrics", {
        "symbol": ticker, "provider": "fmp", "limit": "5",
    })
    income, metrics = await asyncio.gather(income_coro, metrics_coro, return_exceptions=True)
    return {
        "income": income if not isinstance(income, Exception) else [],
        "metrics": metrics if not isinstance(metrics, Exception) else [],
    }

@router.get("/news/{ticker}")
async def news(ticker: str):
    return await obb_get("equity/news", {"symbols": ticker, "provider": "tiingo", "limit": "10"})

@router.get("/earnings")
async def earnings(symbols: str):
    tickers = [s.strip() for s in symbols.split(",") if s.strip()]
    tasks = [
        obb_get("equity/calendar/earnings", {"symbol": s, "provider": "yfinance"})
        for s in tickers
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return [item for r in results if not isinstance(r, Exception) for item in r]

@router.get("/macro/{series_id}")
async def macro(series_id: str, start_date: str | None = None):
    params: dict = {"symbol": series_id, "provider": "fred"}
    params["start_date"] = start_date or (
        date.today() - timedelta(days=365 * 5)
    ).isoformat()
    return await obb_get("economy/fred_series", params)

@router.get("/search")
async def search(query: str):
    if not query.strip():
        return []
    return await obb_get("equity/search", {"query": query, "provider": "yfinance"})
```

- [ ] **Step 2: Register router in main.py**

```python
# main.py — already has: from routers import data, signals, quant, screener
# app.include_router(data.router)  ← already present from Task 1
```

No change needed if you created main.py as written in Task 1.

- [ ] **Step 3: Verify manually (OpenBB must be running on :6900)**

```bash
curl http://localhost:6901/quote/AAPL
# Expected: JSON object with price, day_change_percent, etc.

curl http://localhost:6901/history/AAPL?timeframe=1M
# Expected: JSON array of OHLCV bars
```

- [ ] **Step 4: Commit**

```bash
git add backend/domain_api/routers/data.py
git commit -m "feat: add Domain API data pass-through router"
```

---

## Task 4: Signals router

**Files:**
- Create: `backend/domain_api/routers/signals.py`
- Create: `backend/domain_api/tests/test_signals.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_signals.py
import pytest
from routers.signals import compute_signals
import pandas as pd
import numpy as np

def _make_df(n: int = 60) -> pd.DataFrame:
    """Synthetic OHLCV DataFrame with n bars."""
    np.random.seed(42)
    closes = 100 + np.cumsum(np.random.randn(n) * 0.5)
    df = pd.DataFrame({
        "date": pd.date_range("2024-01-01", periods=n, freq="D"),
        "open": closes * 0.999,
        "high": closes * 1.005,
        "low": closes * 0.995,
        "close": closes,
        "volume": np.random.randint(1_000_000, 5_000_000, n).astype(float),
    })
    return df

def test_compute_signals_keys():
    df = _make_df(60)
    result = compute_signals(df)
    for key in ("dates", "closes", "rsi", "macd_hist", "bbands", "atr",
                "stoch", "adx", "obv", "williams_r", "last"):
        assert key in result, f"Missing key: {key}"

def test_compute_signals_last_keys():
    df = _make_df(60)
    result = compute_signals(df)
    last = result["last"]
    for key in ("rsi", "macd_hist", "bb_upper", "bb_lower",
                "atr", "stoch_k", "stoch_d", "price"):
        assert key in last, f"Missing last key: {key}"

def test_compute_signals_lengths_consistent():
    df = _make_df(60)
    result = compute_signals(df)
    assert len(result["dates"]) == len(result["closes"])
    # RSI needs 14+ bars, so series is shorter than input
    assert len(result["rsi"]) <= len(result["dates"])
    assert len(result["rsi"]) > 0
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend/domain_api
python -m pytest tests/test_signals.py -v
# Expected: ImportError or AttributeError — compute_signals does not exist yet
```

- [ ] **Step 3: Create routers/signals.py**

```python
import asyncio
import pandas as pd
import pandas_ta as ta
from fastapi import APIRouter, HTTPException
from client import obb_get, timeframe_start

router = APIRouter()

def _bars_to_df(bars: list) -> pd.DataFrame:
    df = pd.DataFrame(bars)
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)
    # pandas_ta expects lowercase column names
    df.columns = [c.lower() for c in df.columns]
    for col in ("open", "high", "low", "close", "volume"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df

def _safe_series(df: pd.DataFrame, col: str | None) -> list:
    if not col or col not in df.columns:
        return []
    return [
        {"date": str(row["date"])[:10], "value": float(row[col])}
        for _, row in df.iterrows()
        if pd.notna(row[col])
    ]

def compute_signals(df: pd.DataFrame) -> dict:
    """Pure function: takes OHLCV DataFrame, returns signals dict."""
    df = df.copy()

    # Calculate all indicators
    df.ta.rsi(length=14, append=True)
    df.ta.macd(fast=12, slow=26, signal=9, append=True)
    df.ta.atr(length=14, append=True)
    df.ta.bbands(length=20, std=2, append=True)
    df.ta.stoch(k=14, d=3, smooth_k=3, append=True)
    df.ta.adx(length=14, append=True)
    df.ta.obv(append=True)
    df.ta.willr(length=14, append=True)

    cols = df.columns.tolist()

    def find(prefix: str) -> str | None:
        return next((c for c in cols if c.upper().startswith(prefix.upper())), None)

    rsi_col    = find("RSI_")
    macdh_col  = find("MACDh_")
    macds_col  = find("MACDs_")
    macd_col   = next((c for c in cols if c.upper().startswith("MACD_") and
                       not c.upper().startswith("MACDH") and
                       not c.upper().startswith("MACDS")), None)
    atr_col    = find("ATRr_") or find("ATR_")
    bbu_col    = find("BBU_")
    bbm_col    = find("BBM_")
    bbl_col    = find("BBL_")
    stochk_col = find("STOCHk_")
    stochd_col = find("STOCHd_")
    adx_col    = find("ADX_")
    obv_col    = "OBV" if "OBV" in cols else None
    wr_col     = find("WILLR_")

    dates  = [str(d)[:10] for d in df["date"].tolist()]
    closes = [float(c) for c in df["close"].tolist()]

    # Bollinger Bands — include price for chart overlay
    bbands = []
    if bbu_col:
        for _, row in df.iterrows():
            if pd.notna(row.get(bbu_col)):
                bbands.append({
                    "date":   str(row["date"])[:10],
                    "upper":  float(row[bbu_col]),
                    "middle": float(row[bbm_col]) if bbm_col and pd.notna(row.get(bbm_col)) else None,
                    "lower":  float(row[bbl_col]) if bbl_col and pd.notna(row.get(bbl_col)) else None,
                    "price":  float(row["close"]),
                })

    # Stochastic
    stoch = []
    if stochk_col:
        for _, row in df.iterrows():
            if pd.notna(row.get(stochk_col)):
                stoch.append({
                    "date": str(row["date"])[:10],
                    "k":    float(row[stochk_col]),
                    "d":    float(row[stochd_col]) if stochd_col and pd.notna(row.get(stochd_col)) else None,
                })

    # MACD histogram
    macd_hist = []
    if macdh_col:
        for _, row in df.iterrows():
            if pd.notna(row.get(macdh_col)):
                macd_hist.append({
                    "date":    str(row["date"])[:10],
                    "value":   float(row[macdh_col]),
                    "macd":    float(row[macd_col])  if macd_col  and pd.notna(row.get(macd_col))  else None,
                    "signal":  float(row[macds_col]) if macds_col and pd.notna(row.get(macds_col)) else None,
                })

    last_row = df.iloc[-1]

    def last_val(col: str | None) -> float | None:
        if not col or col not in df.columns:
            return None
        v = last_row.get(col)
        return float(v) if pd.notna(v) else None

    return {
        "dates":      dates,
        "closes":     closes,
        "rsi":        _safe_series(df, rsi_col),
        "macd_hist":  macd_hist,
        "bbands":     bbands,
        "atr":        _safe_series(df, atr_col),
        "stoch":      stoch,
        "adx":        _safe_series(df, adx_col),
        "obv":        _safe_series(df, obv_col),
        "williams_r": _safe_series(df, wr_col),
        "last": {
            "rsi":       last_val(rsi_col),
            "macd_hist": last_val(macdh_col),
            "bb_upper":  last_val(bbu_col),
            "bb_lower":  last_val(bbl_col),
            "atr":       last_val(atr_col),
            "stoch_k":   last_val(stochk_col),
            "stoch_d":   last_val(stochd_col),
            "price":     float(last_row["close"]),
        },
    }

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

- [ ] **Step 4: Run tests to verify they pass**

```bash
python -m pytest tests/test_signals.py -v
# Expected: 3 tests PASSED
```

- [ ] **Step 5: Commit**

```bash
git add backend/domain_api/routers/signals.py backend/domain_api/tests/test_signals.py
git commit -m "feat: add Domain API signals router with pandas_ta indicators"
```

---

## Task 5: Quant router

**Files:**
- Create: `backend/domain_api/routers/quant.py`
- Create: `backend/domain_api/tests/test_quant.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_quant.py
import pytest
import numpy as np
from routers.quant import (
    _daily_returns, _annualized_vol, _sharpe, _sortino,
    _max_drawdown, _drawdown_series, _beta, _var, _cvar, _calmar,
    _histogram, compute_quant,
)

def test_daily_returns_simple():
    closes = np.array([100.0, 110.0, 99.0])
    r = _daily_returns(closes)
    assert len(r) == 2
    assert abs(r[0] - 0.1) < 1e-9
    assert abs(r[1] - (-0.1)) < 1e-6

def test_annualized_vol_constant_series():
    # Constant series → zero volatility
    closes = np.ones(100) * 50.0
    returns = _daily_returns(closes)
    assert _annualized_vol(returns) == 0.0

def test_sharpe_zero_vol():
    closes = np.ones(100) * 50.0
    returns = _daily_returns(closes)
    assert _sharpe(returns) == 0.0

def test_max_drawdown_no_drawdown():
    closes = np.array([100.0, 110.0, 120.0, 130.0])
    dd = _max_drawdown(closes)
    assert dd["value"] == 0.0
    assert dd["duration_days"] == 0

def test_max_drawdown_full():
    closes = np.array([100.0, 80.0, 60.0, 70.0])
    dd = _max_drawdown(closes)
    assert abs(dd["value"] - (-0.4)) < 1e-9

def test_drawdown_series_monotone():
    closes = np.array([100.0, 110.0, 120.0])
    dd = _drawdown_series(closes)
    assert all(v == 0.0 for v in dd)

def test_beta_identical_series():
    r = np.array([0.01, -0.02, 0.015, -0.005, 0.02])
    assert abs(_beta(r, r) - 1.0) < 1e-9

def test_var_normal():
    np.random.seed(42)
    r = np.random.randn(10_000) * 0.01
    v95 = _var(r, 95)
    # VaR at 95% should be around -1.64 * std
    assert v95 < 0

def test_cvar_less_than_var():
    np.random.seed(0)
    r = np.random.randn(1000) * 0.01
    assert _cvar(r, 95) <= _var(r, 95)

def test_histogram_bins():
    r = np.array([0.01, -0.02, 0.015, -0.005, 0.02, -0.01])
    h = _histogram(r, bins=3)
    assert len(h) == 3
    assert sum(b["count"] for b in h) == len(r)

def test_compute_quant_keys():
    np.random.seed(7)
    closes = 100 + np.cumsum(np.random.randn(300) * 0.5)
    spy = 100 + np.cumsum(np.random.randn(300) * 0.4)
    dates = [f"2024-{(i // 30) + 1:02d}-{(i % 28) + 1:02d}" for i in range(300)]
    result = compute_quant(closes, spy, dates, "1Y")
    for key in ("annualized_vol", "sharpe", "sortino", "calmar",
                "var_95", "var_99", "cvar_95", "skewness", "kurtosis",
                "max_drawdown", "drawdown_series", "rolling_vol",
                "rolling_sharpe", "beta", "rolling_beta", "histogram"):
        assert key in result, f"Missing key: {key}"
```

- [ ] **Step 2: Run to verify they fail**

```bash
python -m pytest tests/test_quant.py -v
# Expected: ImportError — quant module does not exist yet
```

- [ ] **Step 3: Create routers/quant.py**

```python
import asyncio
import numpy as np
from scipy import stats
from fastapi import APIRouter, HTTPException
from client import obb_get, timeframe_start

router = APIRouter()

# ── Pure math helpers ─────────────────────────────────────────────────────────

def _daily_returns(closes: np.ndarray) -> np.ndarray:
    return np.diff(closes) / closes[:-1]

def _annualized_vol(returns: np.ndarray) -> float:
    if len(returns) < 2:
        return 0.0
    return float(np.std(returns, ddof=1) * np.sqrt(252))

def _sharpe(returns: np.ndarray, rf: float = 0.05) -> float:
    vol = _annualized_vol(returns)
    return float((np.mean(returns) * 252 - rf) / vol) if vol != 0 else 0.0

def _sortino(returns: np.ndarray, rf: float = 0.05) -> float:
    down = returns[returns < 0]
    dv = float(np.std(down, ddof=1) * np.sqrt(252)) if len(down) > 1 else 0.0
    return float((np.mean(returns) * 252 - rf) / dv) if dv != 0 else 0.0

def _max_drawdown(closes: np.ndarray) -> dict:
    peak = np.maximum.accumulate(closes)
    dd = (closes - peak) / peak
    min_idx = int(np.argmin(dd))
    peak_idx = int(np.argmax(closes[: min_idx + 1])) if min_idx > 0 else 0
    return {"value": float(np.min(dd)), "duration_days": min_idx - peak_idx}

def _drawdown_series(closes: np.ndarray) -> np.ndarray:
    peak = np.maximum.accumulate(closes)
    return (closes - peak) / peak

def _beta(asset: np.ndarray, bench: np.ndarray) -> float:
    n = min(len(asset), len(bench))
    cov = np.cov(asset[:n], bench[:n])
    return float(cov[0, 1] / cov[1, 1]) if cov[1, 1] != 0 else 0.0

def _var(returns: np.ndarray, pct: float) -> float:
    return float(np.percentile(returns, 100 - pct))

def _cvar(returns: np.ndarray, pct: float) -> float:
    threshold = _var(returns, pct)
    tail = returns[returns <= threshold]
    return float(np.mean(tail)) if len(tail) > 0 else threshold

def _calmar(returns: np.ndarray, closes: np.ndarray) -> float:
    dd = abs(_max_drawdown(closes)["value"])
    return float(np.mean(returns) * 252 / dd) if dd != 0 else 0.0

def _histogram(returns: np.ndarray, bins: int = 20) -> list:
    counts, edges = np.histogram(returns, bins=bins)
    centers = (edges[:-1] + edges[1:]) / 2
    return [{"x": float(c), "count": int(n)} for c, n in zip(centers, counts)]

def _rolling(arr: np.ndarray, window: int, fn) -> list:
    return [float(fn(arr[i - window : i])) for i in range(window, len(arr) + 1)]

def _rolling_beta(asset: np.ndarray, bench: np.ndarray, window: int) -> list:
    n = min(len(asset), len(bench))
    a, b = asset[:n], bench[:n]
    return [float(_beta(a[i - window : i], b[i - window : i]))
            for i in range(window, n + 1)]

# ── Core computation ──────────────────────────────────────────────────────────

def compute_quant(
    closes: np.ndarray,
    bench_closes: np.ndarray | None,
    dates: list[str],
    timeframe: str,
) -> dict:
    returns = _daily_returns(closes)
    return_dates = dates[1:]
    roll_window = 30

    roll_vol = _rolling(
        closes, roll_window + 1,
        lambda s: _annualized_vol(_daily_returns(s)),
    )
    roll_sharpe = _rolling(returns, roll_window, _sharpe)
    roll_dates = dates[roll_window:]

    dd_series = _drawdown_series(closes)

    result: dict = {
        "timeframe":       timeframe,
        "annualized_vol":  _annualized_vol(returns),
        "sharpe":          _sharpe(returns),
        "sortino":         _sortino(returns),
        "calmar":          _calmar(returns, closes),
        "var_95":          _var(returns, 95),
        "var_99":          _var(returns, 99),
        "cvar_95":         _cvar(returns, 95),
        "skewness":        float(stats.skew(returns)),
        "kurtosis":        float(stats.kurtosis(returns)),
        "max_drawdown":    _max_drawdown(closes),
        "drawdown_series": [{"date": dates[i], "value": float(dd_series[i])}
                            for i in range(len(dates))],
        "rolling_vol":     [{"date": roll_dates[i], "value": roll_vol[i]}
                            for i in range(len(roll_vol))],
        "rolling_sharpe":  [{"date": roll_dates[i], "value": roll_sharpe[i]}
                            for i in range(len(roll_sharpe))],
        "histogram":       _histogram(returns),
    }

    if bench_closes is not None and len(bench_closes) >= roll_window:
        bench_returns = _daily_returns(bench_closes)
        result["beta"] = _beta(returns, bench_returns)
        rb = _rolling_beta(returns, bench_returns, roll_window)
        result["rolling_beta"] = [{"date": dates[roll_window + i], "value": rb[i]}
                                   for i in range(len(rb))]

    return result

# ── Route ─────────────────────────────────────────────────────────────────────

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

- [ ] **Step 4: Run tests to verify they pass**

```bash
python -m pytest tests/test_quant.py -v
# Expected: all 11 tests PASSED
```

- [ ] **Step 5: Commit**

```bash
git add backend/domain_api/routers/quant.py backend/domain_api/tests/test_quant.py
git commit -m "feat: add Domain API quant router (vol, Sharpe, VaR, drawdown, beta, rolling)"
```

---

## Task 6: Screener and Crypto routers

**Files:**
- Create: `backend/domain_api/routers/screener.py`
- Create: `backend/domain_api/tests/test_screener.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_screener.py
import pytest
from unittest.mock import AsyncMock, patch
from routers.screener import _build_screener_row

def test_build_screener_row_complete():
    quote = {
        "symbol": "AAPL",
        "price": 175.0,
        "day_change_percent": 1.5,
        "volume": 50_000_000,
        "market_cap": 2_700_000_000_000,
        "pe_ratio": 28.5,
    }
    row = _build_screener_row("AAPL", quote, rsi=62.3, return_1m=4.5)
    assert row["ticker"] == "AAPL"
    assert row["price"] == 175.0
    assert row["change1d"] == 1.5
    assert row["rsi"] == 62.3
    assert row["return1m"] == 4.5

def test_build_screener_row_missing_optional():
    quote = {"symbol": "AAPL", "price": 175.0, "day_change_percent": 1.5}
    row = _build_screener_row("AAPL", quote, rsi=None, return_1m=None)
    assert row["ticker"] == "AAPL"
    assert row["volume"] is None
    assert row["rsi"] is None
```

- [ ] **Step 2: Run to verify it fails**

```bash
python -m pytest tests/test_screener.py -v
# Expected: ImportError
```

- [ ] **Step 3: Create routers/screener.py**

```python
import asyncio
import pandas as pd
import pandas_ta as ta
import numpy as np
from fastapi import APIRouter
from client import obb_get, timeframe_start

router = APIRouter()

CRYPTO_SYMBOLS = [
    "BTC-USD", "ETH-USD", "BNB-USD", "SOL-USD", "XRP-USD",
    "ADA-USD", "AVAX-USD", "DOGE-USD", "DOT-USD", "MATIC-USD",
]

def _build_screener_row(
    ticker: str,
    quote: dict,
    rsi: float | None,
    return_1m: float | None,
) -> dict:
    return {
        "ticker":    ticker,
        "price":     quote.get("price", 0.0),
        "change1d":  quote.get("day_change_percent", 0.0),
        "volume":    quote.get("volume"),
        "marketCap": quote.get("market_cap"),
        "pe":        quote.get("pe_ratio"),
        "return1m":  return_1m,
        "rsi":       rsi,
    }

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
        rsi: float | None = None
        return_1m: float | None = None

        if not isinstance(hist_res, Exception) and len(hist_res) >= 15:
            df = pd.DataFrame(hist_res)
            df["close"] = pd.to_numeric(df["close"], errors="coerce")
            df.ta.rsi(length=14, append=True)
            rsi_col = next((c for c in df.columns if c.startswith("RSI_")), None)
            if rsi_col:
                series = df[rsi_col].dropna()
                rsi = float(series.iloc[-1]) if len(series) > 0 else None
            closes = df["close"].dropna().values
            if len(closes) >= 2:
                return_1m = float((closes[-1] - closes[0]) / closes[0] * 100)

        return _build_screener_row(ticker, quote, rsi, return_1m)
    except Exception:
        return None

@router.get("/screener")
async def screener(symbols: str):
    tickers = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    results = await asyncio.gather(*[_fetch_ticker(t) for t in tickers])
    return [r for r in results if r is not None]

@router.get("/crypto/top")
async def crypto_top():
    async def _fetch_crypto(symbol: str) -> dict | None:
        try:
            results = await obb_get("equity/price/quote",
                                    {"symbol": symbol, "provider": "yfinance"})
            return results[0] if results else None
        except Exception:
            return None

    results = await asyncio.gather(*[_fetch_crypto(s) for s in CRYPTO_SYMBOLS])
    return [r for r in results if r is not None]
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python -m pytest tests/test_screener.py -v
# Expected: 2 tests PASSED
```

- [ ] **Step 5: Run full test suite**

```bash
python -m pytest tests/ -v
# Expected: all tests PASSED
```

- [ ] **Step 6: Commit**

```bash
git add backend/domain_api/routers/screener.py backend/domain_api/tests/test_screener.py
git commit -m "feat: add Domain API screener and crypto/top routers"
```

---

## Task 7: Infrastructure — docker-compose and env vars

**Files:**
- Modify: `docker-compose.yml`
- Modify: `frontend/.env.example` (or create if missing)

- [ ] **Step 1: Read current docker-compose.yml**

Open `docker-compose.yml` and locate the `services:` block.

- [ ] **Step 2: Add domain-api service**

Add after the `backend` service block:

```yaml
  domain-api:
    build:
      context: ./backend/domain_api
      dockerfile: Dockerfile
    ports:
      - "6901:6901"
    depends_on:
      - backend
    environment:
      OPENBB_BACKEND_URL: http://backend:6900
    restart: unless-stopped
```

Also add to the `frontend` service environment:

```yaml
      DOMAIN_API_URL: http://domain-api:6901
```

- [ ] **Step 3: Update frontend/.env.example**

Add the new variable:

```env
# URL del Domain API — usata dai Route Handlers server-side
DOMAIN_API_URL=http://localhost:6901
```

- [ ] **Step 4: Update frontend/.env.local (local dev)**

```env
DOMAIN_API_URL=http://localhost:6901
```

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml frontend/.env.example
git commit -m "infra: add domain-api service to docker-compose"
```

---

## Task 8: Frontend types

**Files:**
- Modify: `frontend/types/openbb.ts`

- [ ] **Step 1: Rewrite types/openbb.ts**

Replace the full file content:

```typescript
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
```

- [ ] **Step 2: Run TypeScript type check**

```bash
cd frontend
npx tsc --noEmit
# Expected: errors only from files that still import removed types (TechnicalRow, BBandsBar, OBBResponse)
# These will be fixed in subsequent tasks
```

- [ ] **Step 3: Commit**

```bash
git add frontend/types/openbb.ts
git commit -m "types: update SignalsResult to snake_case, add QuantResult, remove OBBResponse/TechnicalRow/BBandsBar"
```

---

## Task 9: Frontend proxy and openbb.ts rewrite

**Files:**
- Modify: `frontend/next.config.mjs`
- Modify: `frontend/lib/openbb.ts`

- [ ] **Step 1: Update next.config.mjs**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/domain/:path*",
        destination: `${process.env.DOMAIN_API_URL ?? "http://localhost:6901"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
```

Note: the old `/api/openbb` rewrite is removed — all traffic now goes through the Domain API.

- [ ] **Step 2: Rewrite lib/openbb.ts**

```typescript
import type {
  PriceBar, Quote, SearchResult, IncomeStatement, KeyMetrics,
  NewsArticle, FredSeries, EarningsEvent, FundamentalsResult,
  SignalsResult, QuantResult,
} from "@/types/openbb";

// ── Base URL ─────────────────────────────────────────────────────────────────
// Server-side (Route Handlers): calls Domain API directly.
// Browser: routes through Next.js proxy rewrite /api/domain/* → :6901.
// ─────────────────────────────────────────────────────────────────────────────
function getBase(): string {
  if (typeof window === "undefined") {
    return process.env.DOMAIN_API_URL ?? "http://localhost:6901";
  }
  return `${window.location.origin}/api/domain`;
}

// ── In-memory cache (TTL 60s) ─────────────────────────────────────────────────
const _cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 60_000;

function cacheGet<T>(key: string): T | null {
  const entry = _cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data as T;
  return null;
}

function cacheSet(key: string, data: unknown): void {
  _cache.set(key, { data, ts: Date.now() });
}

// ── Core fetch helper ─────────────────────────────────────────────────────────
async function domainFetch<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${getBase()}/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const key = url.toString();

  const cached = cacheGet<T>(key);
  if (cached !== null) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) throw new Error(`Domain API error: ${res.status} on ${path}`);
    const data = await res.json();
    cacheSet(key, data);
    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Timeframe helper (kept for any client-side usage) ─────────────────────────
export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

// ── Data endpoints ────────────────────────────────────────────────────────────

export async function getQuote(symbol: string): Promise<Quote> {
  return domainFetch<Quote>(`quote/${symbol}`);
}

export async function getPriceHistory(
  symbol: string,
  timeframe: string
): Promise<PriceBar[]> {
  return domainFetch<PriceBar[]>(`history/${symbol}`, { timeframe });
}

export async function getCryptoPriceHistory(
  symbol: string,
  timeframe: string
): Promise<PriceBar[]> {
  return domainFetch<PriceBar[]>(`history/${symbol}`, { timeframe });
}

export async function searchEquity(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  return domainFetch<SearchResult[]>("search", { query });
}

export async function getFundamentals(symbol: string): Promise<FundamentalsResult> {
  return domainFetch<FundamentalsResult>(`fundamentals/${symbol}`);
}

/** @deprecated Use getFundamentals() instead */
export async function getIncomeStatement(symbol: string): Promise<IncomeStatement[]> {
  const result = await getFundamentals(symbol);
  return result.income;
}

/** @deprecated Use getFundamentals() instead */
export async function getKeyMetrics(symbol: string): Promise<KeyMetrics[]> {
  const result = await getFundamentals(symbol);
  return result.metrics;
}

export async function getNews(symbols: string): Promise<NewsArticle[]> {
  return domainFetch<NewsArticle[]>(`news/${symbols}`);
}

export async function getFredSeries(
  symbol: string,
  startDate?: string
): Promise<FredSeries[]> {
  const params: Record<string, string> = {};
  if (startDate) params.start_date = startDate;
  return domainFetch<FredSeries[]>(`macro/${symbol}`, params);
}

export async function getEarningsCalendar(
  symbols: string[]
): Promise<EarningsEvent[]> {
  return domainFetch<EarningsEvent[]>("earnings", {
    symbols: symbols.join(","),
  });
}

export async function getCryptoTop10(): Promise<Quote[]> {
  return domainFetch<Quote[]>("crypto/top");
}

// ── Semantic endpoints ────────────────────────────────────────────────────────

export async function getSignals(
  ticker: string,
  timeframe: string
): Promise<SignalsResult> {
  return domainFetch<SignalsResult>(`signals/${ticker}`, { timeframe });
}

export async function getQuant(
  ticker: string,
  timeframe: string = "1Y",
  benchmark: string = "SPY"
): Promise<QuantResult> {
  return domainFetch<QuantResult>(`quant/${ticker}`, { timeframe, benchmark });
}

export async function getScreenerData(
  symbols: string[]
): Promise<
  {
    ticker: string;
    price: number;
    change1d: number;
    volume?: number;
    marketCap?: number;
    pe?: number;
    return1m?: number;
    rsi?: number;
  }[]
> {
  return domainFetch(`screener`, { symbols: symbols.join(",") });
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd frontend
npx tsc --noEmit
# Remaining errors should only be in files that still import from quant.ts
# (analisi/page.tsx, VolatilityChart.tsx, etc.) — fixed in Tasks 11-12
```

- [ ] **Step 4: Commit**

```bash
git add frontend/next.config.mjs frontend/lib/openbb.ts
git commit -m "feat: wire frontend to Domain API, rewrite openbb.ts"
```

---

## Task 10: Frontend signals wiring

**Files:**
- Modify: `frontend/app/api/signals/route.ts`
- Modify: `frontend/components/equity/SignalsPanel.tsx`

- [ ] **Step 1: Simplify signals/route.ts**

Replace the entire file:

```typescript
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker");
  const timeframe = searchParams.get("timeframe") ?? "1M";

  if (!ticker) {
    return NextResponse.json({ error: "ticker mancante" }, { status: 400 });
  }

  const base = process.env.DOMAIN_API_URL ?? "http://localhost:6901";
  const res = await fetch(
    `${base}/signals/${encodeURIComponent(ticker)}?timeframe=${timeframe}`
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: `Domain API error: ${res.status}` },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
```

- [ ] **Step 2: Update SignalsPanel.tsx field references**

In `SignalsPanel.tsx` change the destructuring on line 74:

```typescript
// Before:
const { last, rsi, macdHist, bbands, atr, stoch, adx, obv, wr } = signals;

// After:
const { last, rsi, macd_hist, bbands, atr, stoch, adx, obv, williams_r } = signals;
```

Update all `last.*` references in the component:

| Before | After |
|---|---|
| `last.macdHist` | `last.macd_hist` |
| `last.bbUpper` | `last.bb_upper` |
| `last.bbLower` | `last.bb_lower` |
| `last.stochK` | `last.stoch_k` |
| `last.stochD` | `last.stoch_d` |
| `macdHist` (array) | `macd_hist` |
| `wr` (array) | `williams_r` |

Specifically these lines change:

```typescript
// Line 77 — macdSignal
const macdSignal = interpretMacd(last.macd_hist ?? 0);

// Line 78-80 — bbSignal
const bbSignal = last.bb_upper != null && last.bb_lower != null && last.price != null
  ? interpretBB(last.price, last.bb_upper, last.bb_lower)
  : null;

// Line 93 — MACD value display
<p className="text-white font-semibold">{last.macd_hist?.toFixed(3) ?? "—"}</p>

// Line 99 — BB upper display
{last.bb_upper != null ? `$${last.bb_upper.toFixed(1)}` : "—"}

// Line 113-119 — Stoch K display
{last.stoch_k != null ? last.stoch_k.toFixed(1) : "—"}
...
{last.stoch_k >= 80 ? "Ipercomprato" : last.stoch_k <= 20 ? "Ipervenduto" : "Neutrale"}

// Line 135 — MACD chart data
{macd_hist.length > 0 && (
  <IndicatorChart data={macd_hist} ... />
)}

// Line 236-244 — Williams %R chart
{williams_r.length > 0 && (
  <IndicatorChart data={williams_r} label="Williams %R (14)" ... />
)}
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd frontend
npx tsc --noEmit
# SignalsPanel.tsx should now be clean
```

- [ ] **Step 4: Commit**

```bash
git add frontend/app/api/signals/route.ts frontend/components/equity/SignalsPanel.tsx
git commit -m "feat: wire SignalsPanel to Domain API signals endpoint"
```

---

## Task 11: Frontend analisi page — replace quant.ts with getQuant()

**Files:**
- Modify: `frontend/app/analisi/page.tsx`
- Modify: `frontend/components/analisi/VolatilityChart.tsx`
- Modify: `frontend/components/analisi/DrawdownChart.tsx`
- Modify: `frontend/components/analisi/ReturnsHistogram.tsx`
- Modify: `frontend/components/analisi/CorrelationHeatmap.tsx`

- [ ] **Step 1: Update VolatilityChart.tsx props**

Replace the full file:

```typescript
"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from "recharts";

interface Props {
  data: { date: string; value: number }[];
}

export default function VolatilityChart({ data }: Props) {
  if (data.length === 0) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <span className="text-muted text-xs uppercase tracking-wide">
        Volatilità Rolling 30gg (annualizzata)
      </span>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickFormatter={(v) => v.slice(5)}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
          />
          <Tooltip
            contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }}
            formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, "Volatilità"]}
          />
          <ReferenceLine y={0.2} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: "20%", fill: "#f59e0b", fontSize: 10 }} />
          <Line type="monotone" dataKey="value" stroke="#a78bfa" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Update DrawdownChart.tsx props**

Replace the full file:

```typescript
"use client";

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from "recharts";

interface Props {
  data: { date: string; value: number }[];
  maxDrawdownValue: number;
  durationDays: number;
}

export default function DrawdownChart({ data, maxDrawdownValue, durationDays }: Props) {
  if (data.length === 0) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-muted text-xs uppercase tracking-wide">Drawdown</span>
        <span className="text-negative text-sm font-semibold">
          Max: {(maxDrawdownValue * 100).toFixed(1)}% ({durationDays}gg)
        </span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickFormatter={(v) => v.slice(5)}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
          />
          <Tooltip
            contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }}
            formatter={(v: number) => [`${(v * 100).toFixed(2)}%`, "Drawdown"]}
          />
          <ReferenceLine y={0} stroke="#6b7280" />
          <Area type="monotone" dataKey="value" stroke="#ef4444" fill="#ef444420" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: Update ReturnsHistogram.tsx props**

Replace the full file:

```typescript
"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";

function normalPdf(x: number, mu: number, sigma: number): number {
  if (sigma === 0) return 0;
  return Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));
}

interface Props {
  histogram: { x: number; count: number }[];
  skewness: number;
  kurtosis: number;
}

export default function ReturnsHistogram({ histogram, skewness, kurtosis }: Props) {
  if (histogram.length === 0) return null;

  const total = histogram.reduce((s, b) => s + b.count, 0);
  const mu = histogram.reduce((s, b) => s + b.x * b.count, 0) / total;
  const sigma = Math.sqrt(
    histogram.reduce((s, b) => s + b.count * (b.x - mu) ** 2, 0) / total
  );
  const step = histogram.length > 1 ? histogram[1].x - histogram[0].x : 1;

  const data = histogram.map((b) => ({
    x: b.x,
    count: b.count,
    normal: normalPdf(b.x, mu, sigma) * total * step,
  }));

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-muted text-xs uppercase tracking-wide">Distribuzione Ritorni</span>
        <span className="text-muted text-xs">
          Skew: {skewness.toFixed(2)} · Kurt: {kurtosis.toFixed(2)}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
          <XAxis
            dataKey="x"
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
          />
          <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
          <Tooltip
            contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }}
            formatter={(v: number, name: string) => [
              name === "count" ? v : v.toFixed(2),
              name === "count" ? "Frequenza" : "Normale",
            ]}
          />
          <Bar dataKey="count" fill="#3b82f6" opacity={0.7} isAnimationActive={false} />
          <Line type="monotone" dataKey="normal" stroke="#f59e0b" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 4: Update CorrelationHeatmap.tsx — inline pearsonCorrelation**

Two changes only:
1. Remove line 4: `import { correlationMatrix } from "@/lib/quant";`
2. After `import { useMemo } from "react";`, add these two functions before `interface TickerSeries`:

```typescript
// Inline — only used here, no longer needs quant.ts
function pearsonCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  const ma = a.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const mb = b.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da  += (a[i] - ma) ** 2;
    db  += (b[i] - mb) ** 2;
  }
  const denom = Math.sqrt(da * db);
  return denom === 0 ? 0 : num / denom;
}

function correlationMatrix(series: number[][]): number[][] {
  const n = series.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (__, j) =>
      i === j ? 1 : pearsonCorrelation(series[i], series[j])
    )
  );
}
```

Everything else in the file (the `interface`, `corrColor`, and the component body) stays unchanged.

- [ ] **Step 5: Update analisi/page.tsx**

Replace the full file:

```typescript
"use client";

import { useState, useEffect, useMemo } from "react";
import { getPriceHistory, getQuant } from "@/lib/openbb";
import { useWatchlist } from "@/components/providers/WatchlistProvider";
import QuantStatsCard from "@/components/analisi/QuantStatsCard";
import ReturnsHistogram from "@/components/analisi/ReturnsHistogram";
import VolatilityChart from "@/components/analisi/VolatilityChart";
import DrawdownChart from "@/components/analisi/DrawdownChart";
import CorrelationHeatmap from "@/components/analisi/CorrelationHeatmap";
import type { QuantResult, Timeframe } from "@/types/openbb";

const TIMEFRAMES: Timeframe[] = ["3M", "6M", "1Y", "5Y"];

export default function AnalisiPage() {
  const { tickers } = useWatchlist();
  const [selectedTicker, setSelectedTicker] = useState<string>("");
  const [timeframe, setTimeframe] = useState<Timeframe>("1Y");
  const [quant, setQuant] = useState<QuantResult | null>(null);
  const [corrSeries, setCorrSeries] = useState<{ ticker: string; closes: number[] }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tickers.length > 0 && !selectedTicker) setSelectedTicker(tickers[0]);
  }, [tickers]);

  useEffect(() => {
    if (!selectedTicker) return;
    setLoading(true);
    getQuant(selectedTicker, timeframe, "SPY")
      .then(setQuant)
      .catch(() => setQuant(null))
      .finally(() => setLoading(false));
  }, [selectedTicker, timeframe]);

  useEffect(() => {
    if (tickers.length < 2) return;
    Promise.allSettled(
      tickers.slice(0, 8).map((t) =>
        getPriceHistory(t, "1Y").then((bars) => ({
          ticker: t,
          closes: bars.map((b) => b.close),
        }))
      )
    ).then((results) => {
      setCorrSeries(
        results
          .filter(
            (r): r is PromiseFulfilledResult<{ ticker: string; closes: number[] }> =>
              r.status === "fulfilled"
          )
          .map((r) => r.value)
      );
    });
  }, [tickers.join(",")]);

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Analisi Quantitativa</h1>
        <div className="flex gap-2 items-center flex-wrap">
          <select
            value={selectedTicker}
            onChange={(e) => setSelectedTicker(e.target.value)}
            className="bg-card border border-border text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:border-accent"
          >
            {tickers.length === 0 && <option value="">—</option>}
            {tickers.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
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

      {!loading && quant && (
        <>
          <div className="grid grid-cols-5 gap-3">
            <QuantStatsCard
              label={`Volatilità Ann. ${timeframe}`}
              value={`${(quant.annualized_vol * 100).toFixed(1)}%`}
            />
            <QuantStatsCard
              label="Sharpe Ratio"
              value={quant.sharpe.toFixed(2)}
              color="text-purple-400"
            />
            <QuantStatsCard
              label="Sortino Ratio"
              value={quant.sortino.toFixed(2)}
              color="text-blue-400"
            />
            <QuantStatsCard
              label="Max Drawdown"
              value={`${(quant.max_drawdown.value * 100).toFixed(1)}%`}
              color="text-negative"
              subtext={`${quant.max_drawdown.duration_days}gg durata`}
            />
            <QuantStatsCard
              label="Beta vs SPY"
              value={quant.beta != null ? quant.beta.toFixed(2) : "N/A"}
              color="text-blue-400"
            />
          </div>

          {/* Row 2: new metrics */}
          <div className="grid grid-cols-4 gap-3">
            <QuantStatsCard label="VaR 95%" value={`${(quant.var_95 * 100).toFixed(2)}%`} color="text-negative" />
            <QuantStatsCard label="CVaR 95%" value={`${(quant.cvar_95 * 100).toFixed(2)}%`} color="text-negative" />
            <QuantStatsCard label="Calmar" value={quant.calmar.toFixed(2)} />
            <QuantStatsCard label="Skewness" value={quant.skewness.toFixed(2)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <ReturnsHistogram
              histogram={quant.histogram}
              skewness={quant.skewness}
              kurtosis={quant.kurtosis}
            />
            <VolatilityChart data={quant.rolling_vol} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <DrawdownChart
              data={quant.drawdown_series}
              maxDrawdownValue={quant.max_drawdown.value}
              durationDays={quant.max_drawdown.duration_days}
            />
            <CorrelationHeatmap series={corrSeries} />
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Run TypeScript check — should be clean for analisi/**

```bash
cd frontend
npx tsc --noEmit 2>&1 | grep "analisi"
# Expected: no errors for analisi/ files
```

- [ ] **Step 7: Commit**

```bash
git add frontend/app/analisi/page.tsx \
        frontend/components/analisi/VolatilityChart.tsx \
        frontend/components/analisi/DrawdownChart.tsx \
        frontend/components/analisi/ReturnsHistogram.tsx \
        frontend/components/analisi/CorrelationHeatmap.tsx
git commit -m "feat: migrate analisi page to Domain API getQuant(), update chart components"
```

---

## Task 12: Frontend screener page

**Files:**
- Modify: `frontend/app/screener/page.tsx`

- [ ] **Step 1: Replace the data-fetching useEffect**

In `frontend/app/screener/page.tsx`, replace the imports at the top:

```typescript
// Before:
import { getPriceHistory, getQuote, getOBBRSI } from "@/lib/openbb";

// After:
import { getScreenerData } from "@/lib/openbb";
```

Replace the `useEffect` that fetches screener data (the one containing `Promise.allSettled(universe.map(...))`):

```typescript
useEffect(() => {
  setLoading(true);
  getScreenerData(universe)
    .then((data) => {
      setRows(
        data.map((r) => ({
          ticker:    r.ticker,
          price:     r.price,
          change1d:  r.change1d,
          volume:    r.volume ?? 0,
          marketCap: r.marketCap,
          pe:        r.pe,
          return1m:  r.return1m,
          rsi:       r.rsi,
        }))
      );
    })
    .catch(() => setRows([]))
    .finally(() => setLoading(false));
}, [universe.join(",")]);
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd frontend
npx tsc --noEmit 2>&1 | grep "screener"
# Expected: no errors for screener/
```

- [ ] **Step 3: Commit**

```bash
git add frontend/app/screener/page.tsx
git commit -m "feat: screener page uses bulk getScreenerData() — N×3 calls → 1"
```

---

## Task 13: Delete quant.ts, update frontend tests

**Files:**
- Delete: `frontend/lib/quant.ts`
- Delete: `frontend/__tests__/lib/quant.test.ts`
- Modify: `frontend/__tests__/lib/openbb.test.ts`

- [ ] **Step 1: Run full TypeScript check before deletion**

```bash
cd frontend
npx tsc --noEmit
# Must be zero errors before proceeding
```

- [ ] **Step 2: Delete quant.ts and its tests**

```bash
rm frontend/lib/quant.ts
rm frontend/__tests__/lib/quant.test.ts
```

- [ ] **Step 3: Run TypeScript check again**

```bash
cd frontend
npx tsc --noEmit
# Expected: zero errors
```

- [ ] **Step 4: Update openbb.test.ts**

Replace the full file content. The new tests mock `fetch` for Domain API endpoints instead of `obbPost`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getQuote, getPriceHistory, getSignals, getQuant, getScreenerData, getCryptoTop10 } from "@/lib/openbb";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockSuccess(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => data,
  } as Response);
}

function mockFailure(status = 500) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({}),
  } as Response);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Clear module-level cache between tests
  vi.resetModules();
});

describe("getQuote", () => {
  it("returns quote data from Domain API", async () => {
    const quote = { symbol: "AAPL", price: 175.5, day_change_percent: 1.2 };
    mockSuccess(quote);
    const result = await getQuote("AAPL");
    expect(result.symbol).toBe("AAPL");
    expect(result.price).toBe(175.5);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/quote/AAPL"),
      expect.any(Object)
    );
  });

  it("throws on non-ok response", async () => {
    mockFailure(404);
    await expect(getQuote("INVALID")).rejects.toThrow("Domain API error: 404");
  });
});

describe("getPriceHistory", () => {
  it("returns array of price bars", async () => {
    const bars = [
      { date: "2024-01-01", open: 100, high: 105, low: 99, close: 103, volume: 1000000 },
    ];
    mockSuccess(bars);
    const result = await getPriceHistory("AAPL", "1M");
    expect(result).toHaveLength(1);
    expect(result[0].close).toBe(103);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/history/AAPL"),
      expect.any(Object)
    );
  });
});

describe("getSignals", () => {
  it("returns SignalsResult with expected keys", async () => {
    const signals = {
      dates: ["2024-01-01"],
      closes: [175.0],
      rsi: [],
      macd_hist: [],
      bbands: [],
      atr: [],
      stoch: [],
      adx: [],
      obv: [],
      williams_r: [],
      last: { rsi: 62.4, macd_hist: 0.1, bb_upper: null, bb_lower: null,
              atr: 1.5, stoch_k: null, stoch_d: null, price: 175.0 },
    };
    mockSuccess(signals);
    const result = await getSignals("AAPL", "1M");
    expect(result.last.rsi).toBe(62.4);
    expect(result.williams_r).toBeDefined();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/signals/AAPL"),
      expect.any(Object)
    );
  });
});

describe("getQuant", () => {
  it("returns QuantResult with expected keys", async () => {
    const quant = {
      timeframe: "1Y",
      annualized_vol: 0.23,
      sharpe: 1.2,
      sortino: 1.5,
      calmar: 0.9,
      var_95: -0.02,
      var_99: -0.03,
      cvar_95: -0.025,
      skewness: -0.3,
      kurtosis: 3.1,
      max_drawdown: { value: -0.18, duration_days: 45 },
      drawdown_series: [],
      rolling_vol: [],
      rolling_sharpe: [],
      histogram: [],
    };
    mockSuccess(quant);
    const result = await getQuant("AAPL", "1Y");
    expect(result.sharpe).toBe(1.2);
    expect(result.max_drawdown.value).toBe(-0.18);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/quant/AAPL"),
      expect.any(Object)
    );
  });
});

describe("getScreenerData", () => {
  it("returns array with screener rows", async () => {
    const rows = [
      { ticker: "AAPL", price: 175, change1d: 1.2, rsi: 62, return1m: 4.5 },
    ];
    mockSuccess(rows);
    const result = await getScreenerData(["AAPL"]);
    expect(result).toHaveLength(1);
    expect(result[0].ticker).toBe("AAPL");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/screener"),
      expect.any(Object)
    );
  });
});

describe("getCryptoTop10", () => {
  it("calls /crypto/top endpoint", async () => {
    mockSuccess([{ symbol: "BTC-USD", price: 68000 }]);
    const result = await getCryptoTop10();
    expect(result).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/crypto/top"),
      expect.any(Object)
    );
  });
});
```

- [ ] **Step 5: Run Vitest test suite**

```bash
cd frontend
npm test -- --run
# Expected: quant.test.ts no longer exists, openbb.test.ts passes
# Other test files (portfolio.test.ts, WatchlistManager.test.tsx) should be unaffected
```

- [ ] **Step 6: Final TypeScript check**

```bash
npx tsc --noEmit
# Expected: zero errors
```

- [ ] **Step 7: Commit**

```bash
git add frontend/__tests__/lib/openbb.test.ts
git rm frontend/lib/quant.ts frontend/__tests__/lib/quant.test.ts
git commit -m "refactor: delete quant.ts, update openbb.test.ts for Domain API endpoints"
```

---

## Verification Checklist

After all tasks complete:

- [ ] `GET http://localhost:6901/health` → `{"status":"ok"}`
- [ ] `GET http://localhost:6901/signals/AAPL?timeframe=1M` → JSON with `rsi`, `macd_hist`, `williams_r`, `last`
- [ ] `GET http://localhost:6901/quant/AAPL?timeframe=1Y` → JSON with `sharpe`, `var_95`, `rolling_beta`
- [ ] `GET http://localhost:6901/screener?symbols=AAPL,MSFT` → array of 2 rows
- [ ] `GET http://localhost:6901/crypto/top` → array of ~10 rows
- [ ] Frontend `/equity/[ticker]` page loads SignalsPanel without errors
- [ ] Frontend `/analisi` page shows new metrics (Sortino, VaR, CVaR, Calmar)
- [ ] Frontend `/screener` loads with a single fetch (check Network tab: 1 call to `/api/domain/screener`)
- [ ] `frontend/lib/quant.ts` does not exist
- [ ] `npm test -- --run` passes all remaining tests
- [ ] `npx tsc --noEmit` zero errors
