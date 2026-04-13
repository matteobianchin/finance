"""
Technical indicators implemented with pandas/numpy — no external TA library needed.
All functions accept pd.Series and return pd.Series with NaN for warm-up periods.
"""
import numpy as np
import pandas as pd


# ── Momentum ─────────────────────────────────────────────────────────────────

def rsi(close: pd.Series, length: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / length, min_periods=length).mean()
    avg_loss = loss.ewm(alpha=1 / length, min_periods=length).mean()
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def macd(
    close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9
) -> tuple[pd.Series, pd.Series, pd.Series]:
    """Returns (macd_line, signal_line, histogram)."""
    ema_fast = close.ewm(span=fast, adjust=False).mean()
    ema_slow = close.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def cci(
    high: pd.Series, low: pd.Series, close: pd.Series, length: int = 20
) -> pd.Series:
    """Commodity Channel Index."""
    tp = (high + low + close) / 3
    sma_tp = tp.rolling(length).mean()
    mean_dev = tp.rolling(length).apply(lambda x: np.mean(np.abs(x - x.mean())), raw=True)
    return (tp - sma_tp) / (0.015 * mean_dev)


def mfi(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    volume: pd.Series,
    length: int = 14,
) -> pd.Series:
    """Money Flow Index — volume-weighted RSI."""
    tp = (high + low + close) / 3
    raw_mf = tp * volume
    tp_diff = tp.diff()
    pos_mf = raw_mf.where(tp_diff > 0, 0.0)
    neg_mf = raw_mf.where(tp_diff < 0, 0.0)
    pos_sum = pos_mf.rolling(length).sum()
    neg_sum = neg_mf.rolling(length).sum()
    mfr = pos_sum / neg_sum.replace(0, np.nan)
    return 100 - (100 / (1 + mfr))


def roc(close: pd.Series, length: int = 12) -> pd.Series:
    """Rate of Change (%)."""
    return (close / close.shift(length) - 1) * 100


def stoch(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    k: int = 14,
    d: int = 3,
    smooth_k: int = 3,
) -> tuple[pd.Series, pd.Series]:
    """Returns (stoch_k, stoch_d)."""
    lowest_low = low.rolling(k).min()
    highest_high = high.rolling(k).max()
    raw_k = 100 * (close - lowest_low) / (highest_high - lowest_low)
    stoch_k = raw_k.rolling(smooth_k).mean()
    stoch_d = stoch_k.rolling(d).mean()
    return stoch_k, stoch_d


def williams_r(
    high: pd.Series, low: pd.Series, close: pd.Series, length: int = 14
) -> pd.Series:
    highest_high = high.rolling(length).max()
    lowest_low = low.rolling(length).min()
    return -100 * (highest_high - close) / (highest_high - lowest_low)


def aroon(
    high: pd.Series, low: pd.Series, length: int = 25
) -> tuple[pd.Series, pd.Series]:
    """Returns (aroon_up, aroon_down)."""
    aroon_up = high.rolling(length + 1).apply(
        lambda x: 100 * (length - np.argmax(x[::-1])) / length, raw=True
    )
    aroon_down = low.rolling(length + 1).apply(
        lambda x: 100 * (length - np.argmin(x[::-1])) / length, raw=True
    )
    return aroon_up, aroon_down


# ── Trend ─────────────────────────────────────────────────────────────────────

def adx(
    high: pd.Series, low: pd.Series, close: pd.Series, length: int = 14
) -> pd.Series:
    up = high.diff()
    down = -low.diff()
    plus_dm = pd.Series(
        np.where((up > down) & (up > 0), up, 0.0), index=high.index
    )
    minus_dm = pd.Series(
        np.where((down > up) & (down > 0), down, 0.0), index=high.index
    )
    atr_val = atr(high, low, close, length)
    plus_di = 100 * plus_dm.ewm(alpha=1 / length, min_periods=length).mean() / atr_val
    minus_di = 100 * minus_dm.ewm(alpha=1 / length, min_periods=length).mean() / atr_val
    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di)
    return dx.ewm(alpha=1 / length, min_periods=length).mean()


# ── Volatility ────────────────────────────────────────────────────────────────

def atr(
    high: pd.Series, low: pd.Series, close: pd.Series, length: int = 14
) -> pd.Series:
    prev_close = close.shift(1)
    tr = pd.concat(
        [high - low, (high - prev_close).abs(), (low - prev_close).abs()], axis=1
    ).max(axis=1)
    return tr.ewm(alpha=1 / length, min_periods=length).mean()


def bbands(
    close: pd.Series, length: int = 20, std: float = 2.0
) -> tuple[pd.Series, pd.Series, pd.Series]:
    """Returns (upper, middle, lower)."""
    middle = close.rolling(length).mean()
    std_dev = close.rolling(length).std()
    return middle + std * std_dev, middle, middle - std * std_dev


def donchian(
    high: pd.Series, low: pd.Series, length: int = 20
) -> tuple[pd.Series, pd.Series, pd.Series]:
    """Returns (upper, middle, lower)."""
    upper = high.rolling(length).max()
    lower = low.rolling(length).min()
    middle = (upper + lower) / 2
    return upper, middle, lower


def keltner(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    length: int = 20,
    scalar: float = 2.0,
) -> tuple[pd.Series, pd.Series, pd.Series]:
    """Keltner Channels. Returns (upper, middle, lower)."""
    middle = close.ewm(span=length, adjust=False).mean()
    atr_val = atr(high, low, close, length)
    return middle + scalar * atr_val, middle, middle - scalar * atr_val


# ── Moving Averages ───────────────────────────────────────────────────────────

def sma(close: pd.Series, length: int) -> pd.Series:
    return close.rolling(length).mean()


def ema(close: pd.Series, length: int) -> pd.Series:
    return close.ewm(span=length, adjust=False).mean()


def wma(close: pd.Series, length: int) -> pd.Series:
    weights = np.arange(1, length + 1, dtype=float)
    return close.rolling(length).apply(
        lambda x: np.dot(x, weights) / weights.sum(), raw=True
    )


def vwap(
    high: pd.Series, low: pd.Series, close: pd.Series, volume: pd.Series
) -> pd.Series:
    """Cumulative VWAP over the full series."""
    tp = (high + low + close) / 3
    return (tp * volume).cumsum() / volume.cumsum()


# ── Volume ────────────────────────────────────────────────────────────────────

def obv(close: pd.Series, volume: pd.Series) -> pd.Series:
    direction = np.sign(close.diff())
    direction.iloc[0] = 0
    return (direction * volume).cumsum()


def ad(
    high: pd.Series, low: pd.Series, close: pd.Series, volume: pd.Series
) -> pd.Series:
    """Accumulation/Distribution Line."""
    hl_range = (high - low).replace(0, np.nan)
    clv = ((close - low) - (high - close)) / hl_range
    return (clv * volume).cumsum()
