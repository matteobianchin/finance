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
