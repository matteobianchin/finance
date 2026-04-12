"""
Advanced quantitative finance computations.
Pure math module — no FastAPI dependencies.
"""

import numpy as np
from scipy import stats
from scipy.optimize import minimize


# ── Hurst Exponent (R/S analysis) ────────────────────────────────────────────

def hurst_exponent(prices: np.ndarray, min_window: int = 10) -> float:
    """
    Estimate Hurst exponent via rescaled range (R/S) analysis.
    H < 0.5 → mean-reverting, H ≈ 0.5 → random walk, H > 0.5 → trending.
    """
    n = len(prices)
    if n < 20:
        return 0.5

    lags = []
    rs_vals = []
    for lag in range(min_window, n // 2):
        chunk = prices[:lag]
        mean = np.mean(chunk)
        devs = np.cumsum(chunk - mean)
        r = np.max(devs) - np.min(devs)
        s = np.std(chunk, ddof=1)
        if s > 0:
            lags.append(np.log(lag))
            rs_vals.append(np.log(r / s))

    if len(lags) < 5:
        return 0.5

    slope, _, _, _, _ = stats.linregress(lags, rs_vals)
    return float(np.clip(slope, 0.0, 1.0))


# ── Ornstein-Uhlenbeck Half-life ──────────────────────────────────────────────

def ou_half_life(prices: np.ndarray) -> float | None:
    """
    Estimate mean-reversion half-life (in days) via OLS regression of dP on P_lag.
    Returns None if the series is not mean-reverting (positive lambda).
    """
    if len(prices) < 10:
        return None
    delta = np.diff(prices)
    lag = prices[:-1]
    slope, _, _, _, _ = stats.linregress(lag, delta)
    if slope >= 0:
        return None
    hl = -np.log(2) / slope
    return float(hl) if hl > 0 else None


# ── Augmented Dickey-Fuller (stationarity) ────────────────────────────────────

def adf_pvalue(prices: np.ndarray) -> float:
    """
    ADF stationarity test on log-prices.
    Low p-value (< 0.05) → stationary / mean-reverting.
    """
    from statsmodels.tsa.stattools import adfuller
    if len(prices) < 20:
        return 1.0
    log_prices = np.log(prices + 1e-9)
    try:
        result = adfuller(log_prices, autolag="AIC")
        return float(result[1])
    except Exception:
        return 1.0


# ── Garman-Klass Volatility ────────────────────────────────────────────────────

def garman_klass_vol(
    opens: np.ndarray,
    highs: np.ndarray,
    lows: np.ndarray,
    closes: np.ndarray,
) -> float:
    """
    OHLC-based volatility estimator (more efficient than close-to-close).
    Returns annualized volatility.
    """
    if len(closes) < 2:
        return 0.0
    log_hl = np.log(highs / lows) ** 2
    log_co = np.log(closes / opens) ** 2
    gk = np.mean(0.5 * log_hl - (2 * np.log(2) - 1) * log_co)
    return float(np.sqrt(gk * 252))


# ── Kelly Criterion ────────────────────────────────────────────────────────────

def kelly_fraction(win_rate: float, payoff_ratio: float) -> float:
    """
    Full Kelly criterion: f = win_rate - (1 - win_rate) / payoff_ratio.
    Returns fraction of capital to risk per trade (clipped to [0, 1]).
    """
    if payoff_ratio <= 0:
        return 0.0
    kelly = win_rate - (1 - win_rate) / payoff_ratio
    return float(np.clip(kelly, 0.0, 1.0))


# ── Regime Detection ──────────────────────────────────────────────────────────

def regime_series(
    closes: np.ndarray,
    dates: list[str],
    vol_window: int = 20,
    ret_window: int = 20,
) -> list[dict]:
    """
    Classify each day as one of: Bull, Bear, High-Vol, Neutral.
    Uses rolling return + rolling volatility thresholds.
    """
    if len(closes) < max(vol_window, ret_window) + 2:
        return []

    returns = np.diff(np.log(closes + 1e-9))
    n = len(returns)
    result = []

    for i in range(ret_window, n):
        window_ret = returns[i - ret_window : i]
        roll_ret = float(np.mean(window_ret) * 252)
        roll_vol = float(np.std(window_ret, ddof=1) * np.sqrt(252))

        if roll_vol > 0.30:
            regime = "High-Vol"
        elif roll_ret > 0.10:
            regime = "Bull"
        elif roll_ret < -0.10:
            regime = "Bear"
        else:
            regime = "Neutral"

        result.append({
            "date": dates[i],
            "regime": regime,
            "rolling_return": round(roll_ret, 4),
            "rolling_vol": round(roll_vol, 4),
        })

    return result


def regime_summary(regime_data: list[dict]) -> dict:
    """Percentage of days in each regime."""
    if not regime_data:
        return {}
    total = len(regime_data)
    counts: dict[str, int] = {}
    for r in regime_data:
        counts[r["regime"]] = counts.get(r["regime"], 0) + 1
    return {k: round(v / total, 4) for k, v in counts.items()}


# ── Linear Regression Channel ─────────────────────────────────────────────────

def linear_reg_channel(
    closes: np.ndarray,
    dates: list[str],
) -> dict:
    """
    Fit OLS trend line to log-prices. Returns slope, R², and upper/lower 2σ bands.
    """
    if len(closes) < 10:
        return {}

    x = np.arange(len(closes), dtype=float)
    y = np.log(closes + 1e-9)

    slope, intercept, r_value, _, std_err = stats.linregress(x, y)
    fitted = slope * x + intercept
    residuals = y - fitted
    sigma = float(np.std(residuals, ddof=2))

    series = [
        {
            "date": dates[i],
            "price": float(np.exp(y[i])),
            "mid": float(np.exp(fitted[i])),
            "upper": float(np.exp(fitted[i] + 2 * sigma)),
            "lower": float(np.exp(fitted[i] - 2 * sigma)),
        }
        for i in range(len(closes))
    ]

    return {
        "slope_annualized": float(slope * 252),
        "r_squared": float(r_value ** 2),
        "series": series,
    }


# ── Classic Pivot Points ───────────────────────────────────────────────────────

def classic_pivots(
    last_high: float,
    last_low: float,
    last_close: float,
) -> dict:
    """
    Classic pivot points (daily/weekly high-low-close).
    Returns PP, S1, S2, S3, R1, R2, R3.
    """
    pp = (last_high + last_low + last_close) / 3
    return {
        "pp": round(pp, 4),
        "r1": round(2 * pp - last_low, 4),
        "r2": round(pp + (last_high - last_low), 4),
        "r3": round(last_high + 2 * (pp - last_low), 4),
        "s1": round(2 * pp - last_high, 4),
        "s2": round(pp - (last_high - last_low), 4),
        "s3": round(last_low - 2 * (last_high - pp), 4),
    }


# ── Markowitz Portfolio Optimization ─────────────────────────────────────────

def _portfolio_stats(weights: np.ndarray, mean_ret: np.ndarray, cov: np.ndarray, rf: float = 0.05) -> tuple[float, float, float]:
    """Return (expected_return, volatility, sharpe) for given weights."""
    port_ret = float(np.dot(weights, mean_ret) * 252)
    port_vol = float(np.sqrt(weights @ cov @ weights) * np.sqrt(252))
    sharpe = (port_ret - rf) / port_vol if port_vol > 0 else 0.0
    return port_ret, port_vol, sharpe


def _weights_constraint():
    return [
        {"type": "eq", "fun": lambda w: np.sum(w) - 1},
    ]


def _bounds(n: int):
    return tuple((0.0, 1.0) for _ in range(n))


def max_sharpe_weights(mean_ret: np.ndarray, cov: np.ndarray, rf: float = 0.05) -> np.ndarray:
    n = len(mean_ret)
    w0 = np.ones(n) / n

    def neg_sharpe(w):
        _, vol, sharpe = _portfolio_stats(w, mean_ret, cov, rf)
        return -sharpe if vol > 0 else 0.0

    res = minimize(neg_sharpe, w0, method="SLSQP",
                   bounds=_bounds(n), constraints=_weights_constraint(),
                   options={"ftol": 1e-9, "maxiter": 500})
    return res.x if res.success else w0


def min_variance_weights(mean_ret: np.ndarray, cov: np.ndarray) -> np.ndarray:
    n = len(mean_ret)
    w0 = np.ones(n) / n

    def port_var(w):
        return float(w @ cov @ w)

    res = minimize(port_var, w0, method="SLSQP",
                   bounds=_bounds(n), constraints=_weights_constraint(),
                   options={"ftol": 1e-9, "maxiter": 500})
    return res.x if res.success else w0


def risk_parity_weights(cov: np.ndarray) -> np.ndarray:
    """Equal Risk Contribution weights."""
    n = cov.shape[0]
    w0 = np.ones(n) / n

    def risk_budget_objective(w):
        port_vol = np.sqrt(w @ cov @ w)
        marginal = cov @ w
        risk_contrib = w * marginal / port_vol
        target = port_vol / n
        return float(np.sum((risk_contrib - target) ** 2))

    res = minimize(risk_budget_objective, w0, method="SLSQP",
                   bounds=_bounds(n), constraints=_weights_constraint(),
                   options={"ftol": 1e-12, "maxiter": 1000})
    w = res.x if res.success else w0
    return w / w.sum()


def efficient_frontier(mean_ret: np.ndarray, cov: np.ndarray, n_points: int = 30) -> list[dict]:
    """Compute efficient frontier: min-variance for a range of target returns."""
    n = len(mean_ret)
    ann_ret = mean_ret * 252

    r_min = float(ann_ret.min())
    r_max = float(ann_ret.max())
    targets = np.linspace(r_min, r_max, n_points)

    frontier = []
    for target in targets:
        constraints = [
            {"type": "eq", "fun": lambda w: np.sum(w) - 1},
            {"type": "eq", "fun": lambda w, t=target: np.dot(w, ann_ret) - t},
        ]
        res = minimize(
            lambda w: float(w @ cov @ w),
            np.ones(n) / n,
            method="SLSQP",
            bounds=_bounds(n),
            constraints=constraints,
            options={"ftol": 1e-9, "maxiter": 500},
        )
        if res.success:
            vol = float(np.sqrt(res.x @ cov @ res.x) * np.sqrt(252))
            frontier.append({"ret": round(float(target), 4), "vol": round(vol, 4)})

    return frontier


def portfolio_optimize(
    returns_matrix: np.ndarray,   # shape (T, N) — daily returns per asset
    tickers: list[str],
    rf: float = 0.05,
) -> dict:
    """
    Full Markowitz optimization.
    Returns Max Sharpe, Min Variance, Risk Parity weights + efficient frontier.
    """
    mean_ret = np.mean(returns_matrix, axis=0)
    cov = np.cov(returns_matrix.T)          # (N, N) annualized later in stats
    cov_ann = cov * 252

    ms_w  = max_sharpe_weights(mean_ret, cov_ann, rf)
    mv_w  = min_variance_weights(mean_ret, cov_ann)
    rp_w  = risk_parity_weights(cov_ann)
    ef    = efficient_frontier(mean_ret, cov_ann)

    def fmt_port(w):
        ret, vol, sharpe = _portfolio_stats(w, mean_ret, cov_ann, rf)
        return {
            "weights": {t: round(float(wi), 4) for t, wi in zip(tickers, w)},
            "expected_return": round(ret, 4),
            "volatility": round(vol, 4),
            "sharpe": round(sharpe, 4),
        }

    return {
        "max_sharpe": fmt_port(ms_w),
        "min_variance": fmt_port(mv_w),
        "risk_parity": fmt_port(rp_w),
        "efficient_frontier": ef,
    }
