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
