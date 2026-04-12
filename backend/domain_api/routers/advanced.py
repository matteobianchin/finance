import asyncio
import numpy as np
from fastapi import APIRouter, HTTPException
from fetcher import fetch_history, timeframe_start
from quant_advanced import (
    hurst_exponent, ou_half_life, garman_klass_vol, kelly_fraction,
    regime_series, regime_summary, linear_reg_channel, classic_pivots,
    portfolio_optimize,
)

router = APIRouter()


# ── /advanced/{ticker} ────────────────────────────────────────────────────────

@router.get("/advanced/{ticker}")
async def advanced(ticker: str, timeframe: str = "1Y"):
    bars = await fetch_history(ticker, timeframe_start(timeframe))
    if len(bars) < 30:
        raise HTTPException(status_code=422, detail="Insufficient data")

    closes = np.array([float(b["close"]) for b in bars])
    opens  = np.array([float(b["open"])  for b in bars])
    highs  = np.array([float(b["high"])  for b in bars])
    lows   = np.array([float(b["low"])   for b in bars])
    dates  = [str(b["date"])[:10] for b in bars]

    returns = np.diff(np.log(closes + 1e-9))
    win_rate = float(np.mean(returns > 0))
    wins   = returns[returns > 0]
    losses = returns[returns < 0]
    payoff = float(np.mean(wins) / abs(np.mean(losses))) if len(wins) and len(losses) else 0.0

    reg_series = regime_series(closes, dates)

    # ADF is optional — requires statsmodels
    adf_p: float | None = None
    try:
        from quant_advanced import adf_pvalue
        adf_p = adf_pvalue(closes)
    except ImportError:
        pass

    return {
        "ticker": ticker,
        "timeframe": timeframe,
        # ── Regime analysis
        "hurst": round(hurst_exponent(closes), 4),
        "ou_half_life": ou_half_life(closes),
        "adf_pvalue": adf_p,
        # ── Volatility
        "gk_vol": round(garman_klass_vol(opens, highs, lows, closes), 4),
        # ── Position sizing
        "kelly": round(kelly_fraction(win_rate, payoff), 4),
        # ── Regime
        "regime_series": reg_series,
        "regime_summary": regime_summary(reg_series),
        # ── Trend
        "linear_channel": linear_reg_channel(closes, dates),
        # ── Pivot points (last bar's H/L/C)
        "pivots": classic_pivots(float(highs[-1]), float(lows[-1]), float(closes[-1])),
    }


# ── /portfolio/optimize ───────────────────────────────────────────────────────

@router.get("/portfolio/optimize")
async def optimize_portfolio(symbols: str, timeframe: str = "1Y"):
    tickers = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if len(tickers) < 2:
        raise HTTPException(status_code=422, detail="At least 2 symbols required")
    if len(tickers) > 15:
        raise HTTPException(status_code=422, detail="Max 15 symbols")

    start = timeframe_start(timeframe)
    tasks = [fetch_history(t, start) for t in tickers]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Keep only tickers with sufficient data
    valid: list[tuple[str, np.ndarray]] = []
    for ticker, res in zip(tickers, results):
        if not isinstance(res, Exception) and len(res) >= 60:
            closes = np.array([float(b["close"]) for b in res])
            rets = np.diff(np.log(closes + 1e-9))
            valid.append((ticker, rets))

    if len(valid) < 2:
        raise HTTPException(status_code=422, detail="Insufficient data for optimization")

    # Align series to minimum length
    min_len = min(len(r) for _, r in valid)
    valid_tickers = [t for t, _ in valid]
    matrix = np.column_stack([r[-min_len:] for _, r in valid])  # (T, N)

    result = portfolio_optimize(matrix, valid_tickers)
    result["tickers"] = valid_tickers
    result["timeframe"] = timeframe
    return result
