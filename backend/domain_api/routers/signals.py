import asyncio
import pandas as pd
import pandas_ta as ta
from fastapi import APIRouter, HTTPException
from client import obb_get, timeframe_start

router = APIRouter()

def _bars_to_df(bars: list) -> pd.DataFrame:
    df = pd.DataFrame(bars)
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)
    # pandas_ta expects lowercase column names
    df.columns = [c.lower() for c in df.columns]
    for col in ("open", "high", "low", "close", "volume"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df

def _safe_series(df: pd.DataFrame, col: str | None) -> list:
    if not col or col not in df.columns:
        return []
    return [
        {"date": str(row["date"])[:10], "value": float(row[col])}
        for _, row in df.iterrows()
        if pd.notna(row[col])
    ]

def compute_signals(df: pd.DataFrame) -> dict:
    """Pure function: takes OHLCV DataFrame, returns signals dict."""
    df = df.copy()

    # Calculate all indicators
    df.ta.rsi(length=14, append=True)
    df.ta.macd(fast=12, slow=26, signal=9, append=True)
    df.ta.atr(length=14, append=True)
    df.ta.bbands(length=20, std=2, append=True)
    df.ta.stoch(k=14, d=3, smooth_k=3, append=True)
    df.ta.adx(length=14, append=True)
    df.ta.obv(append=True)
    df.ta.willr(length=14, append=True)

    cols = df.columns.tolist()

    def find(prefix: str) -> str | None:
        return next((c for c in cols if c.upper().startswith(prefix.upper())), None)

    rsi_col    = find("RSI_")
    macdh_col  = find("MACDh_")
    macds_col  = find("MACDs_")
    macd_col   = next((c for c in cols if c.upper().startswith("MACD_") and
                       not c.upper().startswith("MACDH") and
                       not c.upper().startswith("MACDS")), None)
    atr_col    = find("ATRr_") or find("ATR_")
    bbu_col    = find("BBU_")
    bbm_col    = find("BBM_")
    bbl_col    = find("BBL_")
    stochk_col = find("STOCHk_")
    stochd_col = find("STOCHd_")
    adx_col    = find("ADX_")
    obv_col    = "OBV" if "OBV" in cols else None
    wr_col     = find("WILLR_")

    dates  = [str(d)[:10] for d in df["date"].tolist()]
    closes = [float(c) for c in df["close"].tolist()]

    # Bollinger Bands — include price for chart overlay
    bbands = []
    if bbu_col:
        for _, row in df.iterrows():
            if pd.notna(row.get(bbu_col)):
                bbands.append({
                    "date":   str(row["date"])[:10],
                    "upper":  float(row[bbu_col]),
                    "middle": float(row[bbm_col]) if bbm_col and pd.notna(row.get(bbm_col)) else None,
                    "lower":  float(row[bbl_col]) if bbl_col and pd.notna(row.get(bbl_col)) else None,
                    "price":  float(row["close"]),
                })

    # Stochastic
    stoch = []
    if stochk_col:
        for _, row in df.iterrows():
            if pd.notna(row.get(stochk_col)):
                stoch.append({
                    "date": str(row["date"])[:10],
                    "k":    float(row[stochk_col]),
                    "d":    float(row[stochd_col]) if stochd_col and pd.notna(row.get(stochd_col)) else None,
                })

    # MACD histogram
    macd_hist = []
    if macdh_col:
        for _, row in df.iterrows():
            if pd.notna(row.get(macdh_col)):
                macd_hist.append({
                    "date":    str(row["date"])[:10],
                    "value":   float(row[macdh_col]),
                    "macd":    float(row[macd_col])  if macd_col  and pd.notna(row.get(macd_col))  else None,
                    "signal":  float(row[macds_col]) if macds_col and pd.notna(row.get(macds_col)) else None,
                })

    last_row = df.iloc[-1]

    def last_val(col: str | None) -> float | None:
        if not col or col not in df.columns:
            return None
        v = last_row.get(col)
        return float(v) if pd.notna(v) else None

    return {
        "dates":      dates,
        "closes":     closes,
        "rsi":        _safe_series(df, rsi_col),
        "macd_hist":  macd_hist,
        "bbands":     bbands,
        "atr":        _safe_series(df, atr_col),
        "stoch":      stoch,
        "adx":        _safe_series(df, adx_col),
        "obv":        _safe_series(df, obv_col),
        "williams_r": _safe_series(df, wr_col),
        "last": {
            "rsi":       last_val(rsi_col),
            "macd_hist": last_val(macdh_col),
            "bb_upper":  last_val(bbu_col),
            "bb_lower":  last_val(bbl_col),
            "atr":       last_val(atr_col),
            "stoch_k":   last_val(stochk_col),
            "stoch_d":   last_val(stochd_col),
            "price":     float(last_row["close"]),
        },
    }

@router.get("/signals/{ticker}")
async def signals(ticker: str, timeframe: str = "1M"):
    params: dict = {
        "symbol": ticker,
        "provider": "yfinance",
        "start_date": timeframe_start(timeframe),
    }
    if timeframe == "1D":
        params["interval"] = "5m"

    bars = await obb_get("equity/price/historical", params)
    if len(bars) < 2:
        raise HTTPException(status_code=422, detail="Insufficient data")

    df = _bars_to_df(bars)
    return compute_signals(df)
