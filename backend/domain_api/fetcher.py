"""
Direct data fetcher — replaces client.py HTTP proxy to OpenBB Platform.
Wraps yfinance (sync) in asyncio executor so callers stay fully async.
"""

import asyncio
from datetime import date, timedelta

import yfinance as yf


# ── Timeframe helpers ─────────────────────────────────────────────────────────

def timeframe_start(timeframe: str) -> str:
    """Return ISO start date string for a given timeframe label."""
    today = date.today()
    mapping = {
        "1D":  today - timedelta(days=1),
        "5D":  today - timedelta(days=5),
        "1M":  today - timedelta(days=30),
        "3M":  today - timedelta(days=90),
        "6M":  today - timedelta(days=180),
        "1Y":  today - timedelta(days=365),
        "2Y":  today - timedelta(days=730),
        "5Y":  today - timedelta(days=1825),
    }
    return str(mapping.get(timeframe, today - timedelta(days=365)))


# ── History ───────────────────────────────────────────────────────────────────

def _sync_fetch_history(ticker: str, start: str, interval: str) -> list[dict]:
    try:
        tk = yf.Ticker(ticker)
        df = tk.history(start=start, interval=interval, auto_adjust=True)
        if df.empty:
            return []
        df.index = df.index.tz_localize(None) if df.index.tzinfo else df.index
        rows = []
        for ts, row in df.iterrows():
            rows.append({
                "date":   str(ts)[:10],
                "open":   float(row["Open"]),
                "high":   float(row["High"]),
                "low":    float(row["Low"]),
                "close":  float(row["Close"]),
                "volume": int(row["Volume"]) if row["Volume"] == row["Volume"] else 0,
            })
        return rows
    except Exception:
        return []


async def fetch_history(
    ticker: str,
    start: str,
    interval: str = "1d",
) -> list[dict]:
    """Async wrapper around yfinance history. Returns [] on any error."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None, _sync_fetch_history, ticker, start, interval
    )


# ── Quote ─────────────────────────────────────────────────────────────────────

def _sync_fetch_quote(ticker: str) -> dict | None:
    try:
        info = yf.Ticker(ticker).info
        price = info.get("regularMarketPrice") or info.get("currentPrice")
        if not price:
            return None
        return {
            "symbol":           ticker,
            "price":            float(price),
            "day_change":       float(info.get("regularMarketChange", 0.0)),
            "day_change_percent": float(info.get("regularMarketChangePercent", 0.0)) * 100,
            "volume":           info.get("regularMarketVolume"),
            "market_cap":       info.get("marketCap"),
            "pe_ratio":         info.get("trailingPE"),
            "name":             info.get("longName") or info.get("shortName", ticker),
            "exchange":         info.get("exchange"),
        }
    except Exception:
        return None


async def fetch_quote(ticker: str) -> dict | None:
    """Async wrapper around yfinance quote info. Returns None on any error."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _sync_fetch_quote, ticker)
