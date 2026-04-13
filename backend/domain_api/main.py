from dotenv import load_dotenv
load_dotenv()

import os
import sys
from fastapi import FastAPI
from routers import data, signals, quant, screener, advanced

app = FastAPI(title="OpenBB Domain API", version="1.0.0")

app.include_router(data.router)
app.include_router(signals.router)
app.include_router(quant.router)
app.include_router(screener.router)
app.include_router(advanced.router)

_REQUIRED_KEYS = {
    "FMP_API_KEY":    "fondamentali ed earnings",
    "TIINGO_API_KEY": "news",
    "FRED_API_KEY":   "dati macro (FRED)",
}

# Warn at startup so the problem is visible immediately in the terminal
for key, desc in _REQUIRED_KEYS.items():
    if not os.getenv(key):
        print(f"[WARNING] {key} non impostata — {desc} non disponibili", file=sys.stderr)


@app.get("/health")
async def health():
    providers = {
        "fmp":    bool(os.getenv("FMP_API_KEY")),
        "tiingo": bool(os.getenv("TIINGO_API_KEY")),
        "fred":   bool(os.getenv("FRED_API_KEY")),
    }
    return {
        "status":    "ok" if all(providers.values()) else "degraded",
        "providers": providers,
    }
