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
