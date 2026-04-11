import pytest
import numpy as np
from routers.quant import (
    _daily_returns, _annualized_vol, _sharpe, _sortino,
    _max_drawdown, _drawdown_series, _beta, _var, _cvar, _calmar,
    _histogram, compute_quant,
)

def test_daily_returns_simple():
    closes = np.array([100.0, 110.0, 99.0])
    r = _daily_returns(closes)
    assert len(r) == 2
    assert abs(r[0] - 0.1) < 1e-9
    assert abs(r[1] - (-0.1)) < 1e-6

def test_annualized_vol_constant_series():
    # Constant series → zero volatility
    closes = np.ones(100) * 50.0
    returns = _daily_returns(closes)
    assert _annualized_vol(returns) == 0.0

def test_sharpe_zero_vol():
    closes = np.ones(100) * 50.0
    returns = _daily_returns(closes)
    assert _sharpe(returns) == 0.0

def test_max_drawdown_no_drawdown():
    closes = np.array([100.0, 110.0, 120.0, 130.0])
    dd = _max_drawdown(closes)
    assert dd["value"] == 0.0
    assert dd["duration_days"] == 0

def test_max_drawdown_full():
    closes = np.array([100.0, 80.0, 60.0, 70.0])
    dd = _max_drawdown(closes)
    assert abs(dd["value"] - (-0.4)) < 1e-9

def test_drawdown_series_monotone():
    closes = np.array([100.0, 110.0, 120.0])
    dd = _drawdown_series(closes)
    assert all(v == 0.0 for v in dd)

def test_beta_identical_series():
    r = np.array([0.01, -0.02, 0.015, -0.005, 0.02])
    assert abs(_beta(r, r) - 1.0) < 1e-9

def test_var_normal():
    np.random.seed(42)
    r = np.random.randn(10_000) * 0.01
    v95 = _var(r, 95)
    # VaR at 95% should be around -1.64 * std
    assert v95 < 0

def test_cvar_less_than_var():
    np.random.seed(0)
    r = np.random.randn(1000) * 0.01
    assert _cvar(r, 95) <= _var(r, 95)

def test_histogram_bins():
    r = np.array([0.01, -0.02, 0.015, -0.005, 0.02, -0.01])
    h = _histogram(r, bins=3)
    assert len(h) == 3
    assert sum(b["count"] for b in h) == len(r)

def test_compute_quant_keys():
    np.random.seed(7)
    closes = 100 + np.cumsum(np.random.randn(300) * 0.5)
    spy = 100 + np.cumsum(np.random.randn(300) * 0.4)
    dates = [f"2024-{(i // 30) + 1:02d}-{(i % 28) + 1:02d}" for i in range(300)]
    result = compute_quant(closes, spy, dates, "1Y")
    for key in ("annualized_vol", "sharpe", "sortino", "calmar",
                "var_95", "var_99", "cvar_95", "skewness", "kurtosis",
                "max_drawdown", "drawdown_series", "rolling_vol",
                "rolling_sharpe", "beta", "rolling_beta", "histogram"):
        assert key in result, f"Missing key: {key}"
