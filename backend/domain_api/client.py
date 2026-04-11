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
