import asyncio
import pandas as pd
import numpy as np
from fastapi import APIRouter
from fetcher import fetch_quote, fetch_history, timeframe_start
from indicators import rsi as calc_rsi

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
        quote, hist = await asyncio.gather(
            fetch_quote(ticker),
            fetch_history(ticker, timeframe_start("1M")),
            return_exceptions=True,
        )

        if isinstance(quote, Exception) or not quote:
            return None

        rsi_val: float | None = None
        return_1m: float | None = None

        if not isinstance(hist, Exception) and len(hist) >= 15:
            df = pd.DataFrame(hist)
            df["close"] = pd.to_numeric(df["close"], errors="coerce")
            rsi_series = calc_rsi(df["close"], length=14).dropna()
            rsi_val = float(rsi_series.iloc[-1]) if len(rsi_series) > 0 else None
            closes = df["close"].dropna().values
            if len(closes) >= 2:
                return_1m = float((closes[-1] - closes[0]) / closes[0] * 100)

        return _build_screener_row(ticker, quote, rsi_val, return_1m)
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
            return await fetch_quote(symbol)
        except Exception:
            return None

    results = await asyncio.gather(*[_fetch_crypto(s) for s in CRYPTO_SYMBOLS])
    return [r for r in results if r is not None]
