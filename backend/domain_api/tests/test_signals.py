import pytest
from routers.signals import compute_signals
import pandas as pd
import numpy as np

def _make_df(n: int = 60) -> pd.DataFrame:
    """Synthetic OHLCV DataFrame with n bars."""
    np.random.seed(42)
    closes = 100 + np.cumsum(np.random.randn(n) * 0.5)
    df = pd.DataFrame({
        "date": pd.date_range("2024-01-01", periods=n, freq="D"),
        "open": closes * 0.999,
        "high": closes * 1.005,
        "low": closes * 0.995,
        "close": closes,
        "volume": np.random.randint(1_000_000, 5_000_000, n).astype(float),
    })
    return df

def test_compute_signals_keys():
    df = _make_df(60)
    result = compute_signals(df)
    for key in ("dates", "closes", "rsi", "macd_hist", "bbands", "atr",
                "stoch", "adx", "obv", "williams_r", "last"):
        assert key in result, f"Missing key: {key}"

def test_compute_signals_last_keys():
    df = _make_df(60)
    result = compute_signals(df)
    last = result["last"]
    for key in ("rsi", "macd_hist", "bb_upper", "bb_lower",
                "atr", "stoch_k", "stoch_d", "price"):
        assert key in last, f"Missing last key: {key}"

def test_compute_signals_lengths_consistent():
    df = _make_df(60)
    result = compute_signals(df)
    assert len(result["dates"]) == len(result["closes"])
    # RSI needs 14+ bars, so series is shorter than input
    assert len(result["rsi"]) <= len(result["dates"])
    assert len(result["rsi"]) > 0
