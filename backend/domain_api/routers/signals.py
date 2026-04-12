import asyncio
import pandas as pd
from fastapi import APIRouter, HTTPException
from fetcher import fetch_history, timeframe_start
from indicators import (
    rsi, macd, cci, mfi, roc, stoch, williams_r, aroon,
    adx, atr, bbands, donchian, keltner,
    sma, ema, vwap,
    obv, ad,
)

router = APIRouter()


def _bars_to_df(bars: list) -> pd.DataFrame:
    df = pd.DataFrame(bars)
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)
    df.columns = [c.lower() for c in df.columns]
    for col in ("open", "high", "low", "close", "volume"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def _safe_series(series: pd.Series, dates: pd.Series) -> list:
    out = []
    for date, value in zip(dates, series):
        if pd.notna(value):
            out.append({"date": str(date)[:10], "value": float(value)})
    return out


def _last(series: pd.Series) -> float | None:
    v = series.dropna()
    return float(v.iloc[-1]) if len(v) > 0 else None


def compute_signals(df: pd.DataFrame) -> dict:
    """Pure function: takes OHLCV DataFrame, returns signals dict."""
    c = df["close"]
    h = df["high"]
    l = df["low"]
    v = df["volume"]
    dates = df["date"]

    # ── Momentum ──────────────────────────────────────────────────────────────
    rsi_s      = rsi(c, 14)
    ml, ms, mh = macd(c, 12, 26, 9)
    cci_s      = cci(h, l, c, 20)
    mfi_s      = mfi(h, l, c, v, 14)
    roc_s      = roc(c, 12)
    sk, sd     = stoch(h, l, c, 14, 3, 3)
    wr_s       = williams_r(h, l, c, 14)
    adx_s      = adx(h, l, c, 14)
    aroon_up, aroon_down = aroon(h, l, 25)

    # ── Volatility ────────────────────────────────────────────────────────────
    atr_s          = atr(h, l, c, 14)
    bbu, bbm, bbl  = bbands(c, 20, 2.0)
    dcu, dcm, dcl  = donchian(h, l, 20)
    kcu, kcm, kcl  = keltner(h, l, c, 20, 2.0)

    # ── Moving Averages ───────────────────────────────────────────────────────
    sma20_s  = sma(c, 20)
    sma50_s  = sma(c, 50)
    sma200_s = sma(c, 200)
    ema9_s   = ema(c, 9)
    ema21_s  = ema(c, 21)
    ema50_s  = ema(c, 50)
    ema200_s = ema(c, 200)
    vwap_s   = vwap(h, l, c, v)

    # ── Volume ────────────────────────────────────────────────────────────────
    obv_s = obv(c, v)
    ad_s  = ad(h, l, c, v)

    # ── Build MACD histogram series ───────────────────────────────────────────
    macd_hist = []
    for i, date in enumerate(dates):
        if pd.notna(mh.iloc[i]):
            macd_hist.append({
                "date":   str(date)[:10],
                "value":  float(mh.iloc[i]),
                "macd":   float(ml.iloc[i]) if pd.notna(ml.iloc[i]) else None,
                "signal": float(ms.iloc[i]) if pd.notna(ms.iloc[i]) else None,
            })

    # ── Bollinger Bands ───────────────────────────────────────────────────────
    bbands_out = []
    for i, date in enumerate(dates):
        if pd.notna(bbu.iloc[i]):
            bbands_out.append({
                "date":   str(date)[:10],
                "upper":  float(bbu.iloc[i]),
                "middle": float(bbm.iloc[i]) if pd.notna(bbm.iloc[i]) else None,
                "lower":  float(bbl.iloc[i]) if pd.notna(bbl.iloc[i]) else None,
                "price":  float(c.iloc[i]),
            })

    # ── Stochastic ────────────────────────────────────────────────────────────
    stoch_out = []
    for i, date in enumerate(dates):
        if pd.notna(sk.iloc[i]):
            stoch_out.append({
                "date": str(date)[:10],
                "k":    float(sk.iloc[i]),
                "d":    float(sd.iloc[i]) if pd.notna(sd.iloc[i]) else None,
            })

    # ── Aroon ─────────────────────────────────────────────────────────────────
    aroon_out = []
    for i, date in enumerate(dates):
        if pd.notna(aroon_up.iloc[i]):
            aroon_out.append({
                "date": str(date)[:10],
                "up":   float(aroon_up.iloc[i]),
                "down": float(aroon_down.iloc[i]) if pd.notna(aroon_down.iloc[i]) else None,
            })

    # ── Donchian Channels ─────────────────────────────────────────────────────
    donchian_out = []
    for i, date in enumerate(dates):
        if pd.notna(dcu.iloc[i]):
            donchian_out.append({
                "date":   str(date)[:10],
                "upper":  float(dcu.iloc[i]),
                "middle": float(dcm.iloc[i]) if pd.notna(dcm.iloc[i]) else None,
                "lower":  float(dcl.iloc[i]) if pd.notna(dcl.iloc[i]) else None,
                "price":  float(c.iloc[i]),
            })

    # ── Keltner Channels ──────────────────────────────────────────────────────
    keltner_out = []
    for i, date in enumerate(dates):
        if pd.notna(kcu.iloc[i]):
            keltner_out.append({
                "date":   str(date)[:10],
                "upper":  float(kcu.iloc[i]),
                "middle": float(kcm.iloc[i]) if pd.notna(kcm.iloc[i]) else None,
                "lower":  float(kcl.iloc[i]) if pd.notna(kcl.iloc[i]) else None,
                "price":  float(c.iloc[i]),
            })

    # ── Moving Averages overlay ───────────────────────────────────────────────
    ma_out = []
    for i, date in enumerate(dates):
        ma_out.append({
            "date":   str(date)[:10],
            "price":  float(c.iloc[i]),
            "sma20":  float(sma20_s.iloc[i])  if pd.notna(sma20_s.iloc[i])  else None,
            "sma50":  float(sma50_s.iloc[i])  if pd.notna(sma50_s.iloc[i])  else None,
            "sma200": float(sma200_s.iloc[i]) if pd.notna(sma200_s.iloc[i]) else None,
            "ema9":   float(ema9_s.iloc[i])   if pd.notna(ema9_s.iloc[i])   else None,
            "ema21":  float(ema21_s.iloc[i])  if pd.notna(ema21_s.iloc[i])  else None,
            "ema50":  float(ema50_s.iloc[i])  if pd.notna(ema50_s.iloc[i])  else None,
            "ema200": float(ema200_s.iloc[i]) if pd.notna(ema200_s.iloc[i]) else None,
            "vwap":   float(vwap_s.iloc[i])   if pd.notna(vwap_s.iloc[i])   else None,
        })

    return {
        "dates":   [str(d)[:10] for d in dates],
        "closes":  [float(x) for x in c],
        # Momentum
        "rsi":       _safe_series(rsi_s, dates),
        "macd_hist": macd_hist,
        "cci":       _safe_series(cci_s, dates),
        "mfi":       _safe_series(mfi_s, dates),
        "roc":       _safe_series(roc_s, dates),
        "stoch":     stoch_out,
        "williams_r": _safe_series(wr_s, dates),
        "adx":       _safe_series(adx_s, dates),
        "aroon":     aroon_out,
        # Volatility
        "atr":       _safe_series(atr_s, dates),
        "bbands":    bbands_out,
        "donchian":  donchian_out,
        "keltner":   keltner_out,
        # Moving Averages
        "moving_averages": ma_out,
        # Volume
        "obv": _safe_series(obv_s, dates),
        "ad":  _safe_series(ad_s, dates),
        # Last values for summary card
        "last": {
            "rsi":        _last(rsi_s),
            "macd_hist":  _last(mh),
            "bb_upper":   _last(bbu),
            "bb_lower":   _last(bbl),
            "atr":        _last(atr_s),
            "stoch_k":    _last(sk),
            "stoch_d":    _last(sd),
            "cci":        _last(cci_s),
            "mfi":        _last(mfi_s),
            "roc":        _last(roc_s),
            "adx":        _last(adx_s),
            "williams_r": _last(wr_s),
            "aroon_up":   _last(aroon_up),
            "aroon_down": _last(aroon_down),
            "vwap":       _last(vwap_s),
            "price":      float(c.iloc[-1]),
        },
    }


@router.get("/signals/{ticker}")
async def signals(ticker: str, timeframe: str = "1M"):
    interval = "5m" if timeframe == "1D" else "1d"
    bars = await fetch_history(ticker, timeframe_start(timeframe), interval=interval)
    if len(bars) < 2:
        raise HTTPException(status_code=422, detail="Insufficient data")

    df = _bars_to_df(bars)
    return compute_signals(df)
