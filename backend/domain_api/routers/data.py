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
