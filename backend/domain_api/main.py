import os
from fastapi import FastAPI
from routers import data, signals, quant, screener

app = FastAPI(title="OpenBB Domain API", version="1.0.0")

app.include_router(data.router)
app.include_router(signals.router)
app.include_router(quant.router)
app.include_router(screener.router)

@app.get("/health")
async def health():
    return {"status": "ok"}
