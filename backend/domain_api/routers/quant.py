import asyncio
import numpy as np
from scipy import stats
from fastapi import APIRouter, HTTPException
from fetcher import fetch_history, timeframe_start

router = APIRouter()

# ── Pure math helpers ─────────────────────────────────────────────────────────

def _daily_returns(closes: np.ndarray) -> np.ndarray:
    return np.diff(closes) / closes[:-1]

def _annualized_vol(returns: np.ndarray) -> float:
    return float(np.std(returns, ddof=1) * np.sqrt(252)) if len(returns) >= 2 else 0.0

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

def _rolling_corr(asset: np.ndarray, bench: np.ndarray, window: int) -> list:
    n = min(len(asset), len(bench))
    a, b = asset[:n], bench[:n]
    out = []
    for i in range(window, n + 1):
        r = np.corrcoef(a[i - window : i], b[i - window : i])[0, 1]
        out.append(float(r))
    return out

# ── New risk/performance metrics ──────────────────────────────────────────────

def _information_ratio(asset: np.ndarray, bench: np.ndarray, rf: float = 0.0) -> float:
    n = min(len(asset), len(bench))
    excess = asset[:n] - bench[:n]
    te = float(np.std(excess, ddof=1) * np.sqrt(252))
    return float(np.mean(excess) * 252 / te) if te != 0 else 0.0

def _tail_ratio(returns: np.ndarray) -> float:
    p95 = float(np.percentile(returns, 95))
    p5  = abs(float(np.percentile(returns, 5)))
    return float(p95 / p5) if p5 != 0 else 0.0

def _omega_ratio(returns: np.ndarray, threshold: float = 0.0) -> float:
    daily = threshold / 252
    gains  = returns[returns > daily] - daily
    losses = daily - returns[returns <= daily]
    return float(gains.sum() / losses.sum()) if losses.sum() != 0 else float("inf")

def _ulcer_index(closes: np.ndarray) -> float:
    peak = np.maximum.accumulate(closes)
    dd_pct = 100.0 * (closes - peak) / peak
    return float(np.sqrt(np.mean(dd_pct ** 2)))

def _win_rate(returns: np.ndarray) -> float:
    return float(np.mean(returns > 0))

def _payoff_ratio(returns: np.ndarray) -> float:
    wins   = returns[returns > 0]
    losses = returns[returns < 0]
    if not len(wins) or not len(losses):
        return 0.0
    return float(np.mean(wins) / abs(np.mean(losses)))

def _gain_to_pain(returns: np.ndarray) -> float:
    pain = float(np.sum(np.abs(returns[returns < 0])))
    return float(np.sum(returns) / pain) if pain != 0 else 0.0

def _treynor(returns: np.ndarray, bench: np.ndarray, rf: float = 0.05) -> float:
    b = _beta(returns, bench)
    return float((np.mean(returns) * 252 - rf) / b) if b != 0 else 0.0

def _jensens_alpha(returns: np.ndarray, bench: np.ndarray, rf: float = 0.05) -> float:
    b = _beta(returns, bench)
    market_excess = float(np.mean(bench) * 252 - rf)
    return float(np.mean(returns) * 252 - (rf + b * market_excess))

def _recovery_days(closes: np.ndarray) -> int | None:
    """Days from max drawdown trough back to the previous peak. None if unrecovered."""
    peak_so_far = np.maximum.accumulate(closes)
    dd = (closes - peak_so_far) / peak_so_far
    trough_idx = int(np.argmin(dd))
    if trough_idx == 0:
        return 0
    peak_val = float(np.max(closes[: trough_idx + 1]))
    for i in range(trough_idx + 1, len(closes)):
        if closes[i] >= peak_val:
            return i - trough_idx
    return None  # not yet recovered

def _autocorr(returns: np.ndarray, lag: int = 1) -> float:
    if len(returns) <= lag:
        return 0.0
    return float(np.corrcoef(returns[:-lag], returns[lag:])[0, 1])

def _mad_vol(returns: np.ndarray) -> float:
    """Median Absolute Deviation annualized — robust volatility estimate."""
    from scipy.stats import median_abs_deviation
    return float(median_abs_deviation(returns) * np.sqrt(252) * 1.4826)

def _cvar_99(returns: np.ndarray) -> float:
    return _cvar(returns, 99)

# ── Core computation ──────────────────────────────────────────────────────────

def compute_quant(
    closes: np.ndarray,
    bench_closes: np.ndarray | None,
    dates: list[str],
    timeframe: str,
) -> dict:
    returns = _daily_returns(closes)
    roll_window = 30

    roll_vol    = _rolling(closes, roll_window + 1,
                           lambda s: _annualized_vol(_daily_returns(s)))
    roll_sharpe = _rolling(returns, roll_window, _sharpe)
    roll_dates  = dates[roll_window:]

    dd_series = _drawdown_series(closes)

    jb_stat, jb_pvalue = stats.jarque_bera(returns)

    result: dict = {
        "timeframe":      timeframe,
        # Core risk-adjusted
        "annualized_vol": _annualized_vol(returns),
        "sharpe":         _sharpe(returns),
        "sortino":        _sortino(returns),
        "calmar":         _calmar(returns, closes),
        "omega_ratio":    _omega_ratio(returns),
        "ulcer_index":    _ulcer_index(closes),
        # Tail risk
        "var_95":         _var(returns, 95),
        "var_99":         _var(returns, 99),
        "cvar_95":        _cvar(returns, 95),
        "cvar_99":        _cvar_99(returns),
        "tail_ratio":     _tail_ratio(returns),
        # Distribution
        "skewness":       float(stats.skew(returns)),
        "kurtosis":       float(stats.kurtosis(returns)),
        "jb_pvalue":      float(jb_pvalue),
        "autocorr_lag1":  _autocorr(returns, 1),
        "mad_vol":        _mad_vol(returns),
        # Trade statistics
        "win_rate":       _win_rate(returns),
        "payoff_ratio":   _payoff_ratio(returns),
        "gain_to_pain":   _gain_to_pain(returns),
        # Drawdown
        "max_drawdown":   _max_drawdown(closes),
        "recovery_days":  _recovery_days(closes),
        "drawdown_series": [{"date": dates[i], "value": float(dd_series[i])}
                             for i in range(len(dates))],
        # Rolling windows
        "rolling_vol":    [{"date": roll_dates[i], "value": roll_vol[i]}
                           for i in range(len(roll_vol))],
        "rolling_sharpe": [{"date": roll_dates[i], "value": roll_sharpe[i]}
                           for i in range(len(roll_sharpe))],
        "histogram":      _histogram(returns),
    }

    if bench_closes is not None and len(bench_closes) >= roll_window:
        bench_returns = _daily_returns(bench_closes)
        result["beta"]             = _beta(returns, bench_returns)
        result["information_ratio"] = _information_ratio(returns, bench_returns)
        result["treynor"]          = _treynor(returns, bench_returns)
        result["jensens_alpha"]    = _jensens_alpha(returns, bench_returns)
        rb = _rolling_beta(returns, bench_returns, roll_window)
        rc = _rolling_corr(returns, bench_returns, roll_window)
        n_rb = min(len(rb), len(rc))
        result["rolling_beta"] = [{"date": dates[roll_window + i], "value": rb[i]}
                                   for i in range(len(rb))]
        result["rolling_corr"] = [{"date": dates[roll_window + i], "value": rc[i]}
                                   for i in range(n_rb)]

    return result

# ── Route ─────────────────────────────────────────────────────────────────────

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
