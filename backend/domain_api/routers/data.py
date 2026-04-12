import asyncio
import math
import os
from datetime import date, timedelta

import httpx
import yfinance as yf
from fastapi import APIRouter, HTTPException
from fetcher import fetch_quote, fetch_history, timeframe_start

router = APIRouter()

FMP_BASE = "https://financialmodelingprep.com/api/v3"
TIINGO_BASE = "https://api.tiingo.com"


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _fmp_get(path: str, params: dict | None = None) -> list | dict:
    url = f"{FMP_BASE}/{path}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            r = await client.get(url, params={"apikey": os.getenv("FMP_API_KEY", ""), **(params or {})})
            r.raise_for_status()
            return r.json()
        except httpx.HTTPStatusError:
            return []
        except Exception:
            return []


async def _tiingo_get(path: str, params: dict | None = None) -> list | dict:
    url = f"{TIINGO_BASE}/{path}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            r = await client.get(
                url,
                params=params or {},
                headers={"Authorization": f"Token {os.getenv('TIINGO_API_KEY', '')}"},
            )
            r.raise_for_status()
            return r.json()
        except httpx.HTTPStatusError:
            return []
        except Exception:
            return []


def _safe_float(v) -> float | None:
    try:
        f = float(v)
        return None if math.isnan(f) else f
    except (TypeError, ValueError):
        return None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/quote/{ticker}")
async def quote(ticker: str):
    result = await fetch_quote(ticker)
    if not result:
        raise HTTPException(status_code=404, detail="No quote found")
    return result


@router.get("/history/{ticker}")
async def history(ticker: str, timeframe: str = "1M"):
    interval = "5m" if timeframe == "1D" else "1d"
    return await fetch_history(ticker, timeframe_start(timeframe), interval=interval)


def _parse_income(income_raw: list) -> list:
    income = []
    for row in income_raw:
        income.append({
            "date":         row.get("date", ""),
            "period":       row.get("period", "annual"),
            "revenue":      _safe_float(row.get("revenue")),
            "net_income":   _safe_float(row.get("netIncome")),
            "eps":          _safe_float(row.get("eps")),
            "ebitda":       _safe_float(row.get("ebitda")),
            "gross_profit": _safe_float(row.get("grossProfit")),
        })
    return income


def _parse_metrics(metrics_raw: list) -> list:
    metrics = []
    for row in metrics_raw:
        metrics.append({
            "date":             row.get("date", ""),
            "pe_ratio":         _safe_float(row.get("peRatio")),
            "price_to_book":    _safe_float(row.get("pbRatio")),
            "price_to_sales":   _safe_float(row.get("priceToSalesRatio")),
            "debt_to_equity":   _safe_float(row.get("debtToEquity")),
            "return_on_equity": _safe_float(row.get("roe")),
        })
    return metrics


@router.get("/fundamentals/{ticker}")
async def fundamentals(ticker: str):
    income_raw, metrics_raw = await asyncio.gather(
        _fmp_get(f"income-statement/{ticker}", {"period": "annual", "limit": "5"}),
        _fmp_get(f"key-metrics/{ticker}", {"limit": "5"}),
    )
    return {
        "income":  _parse_income(income_raw if isinstance(income_raw, list) else []),
        "metrics": _parse_metrics(metrics_raw if isinstance(metrics_raw, list) else []),
    }


@router.get("/news/{ticker}")
async def news(ticker: str):
    articles = await _tiingo_get("tiingo/news", {"tickers": ticker, "limit": "10"})
    if not isinstance(articles, list):
        return []
    return [
        {
            "date":    a.get("publishedDate", "")[:10],
            "title":   a.get("title", ""),
            "text":    a.get("description"),
            "url":     a.get("url", ""),
            "source":  a.get("source"),
            "symbols": a.get("tickers"),
        }
        for a in articles
    ]


@router.get("/earnings")
async def earnings(symbols: str):
    tickers = [s.strip() for s in symbols.split(",") if s.strip()]
    if len(tickers) > 20:
        raise HTTPException(status_code=422, detail="Max 20 symbols")

    def _sync_earnings(symbol: str) -> list:
        try:
            df = yf.Ticker(symbol).earnings_dates
            if df is None or df.empty:
                return []
            rows = []
            for dt, row in df.iterrows():
                rows.append({
                    "symbol":           symbol,
                    "date":             str(dt)[:10],
                    "eps_estimate":     _safe_float(row.get("EPS Estimate")),
                    "eps_actual":       _safe_float(row.get("Reported EPS")),
                    "revenue_estimate": None,
                    "revenue_actual":   None,
                })
            return rows
        except Exception:
            return []

    loop = asyncio.get_running_loop()
    results = await asyncio.gather(*[
        loop.run_in_executor(None, _sync_earnings, t) for t in tickers
    ])
    return [item for sublist in results for item in sublist]


@router.get("/macro/{series_id}")
async def macro(series_id: str, start_date: str | None = None):
    start = start_date or (date.today() - timedelta(days=365 * 5)).isoformat()

    def _sync_fred(sid: str, s: str) -> list:
        try:
            import fredapi
            fred = fredapi.Fred(api_key=os.getenv("FRED_API_KEY", ""))
            series = fred.get_series(sid, observation_start=s)
            return [
                {"date": str(idx)[:10], "value": _safe_float(v)}
                for idx, v in series.items()
            ]
        except Exception:
            return []

    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _sync_fred, series_id, start)


@router.get("/search")
async def search(query: str):
    if not query.strip():
        return []

    def _sync_search(q: str) -> list:
        try:
            results = yf.Search(q, max_results=10).quotes
            return [
                {
                    "symbol":        r.get("symbol", ""),
                    "name":          r.get("longname") or r.get("shortname", r.get("symbol", "")),
                    "exchange":      r.get("exchange"),
                    "currency":      r.get("currency"),
                    "security_type": r.get("quoteType"),
                }
                for r in results
                if r.get("symbol")
            ]
        except Exception:
            return []

    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _sync_search, query)
