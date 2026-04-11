"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import IndicatorChart from "@/components/charts/IndicatorChart";
import type { SignalsResult } from "@/types/openbb";

interface Props {
  signals: SignalsResult;
}

function interpretRsi(value: number | null): { label: string; color: string } {
  if (value == null) return { label: "—", color: "text-muted" };
  if (value >= 70) return { label: "Ipercomprato", color: "text-negative" };
  if (value <= 30) return { label: "Ipervenduto", color: "text-positive" };
  return { label: "Neutrale", color: "text-muted" };
}

function interpretMacd(hist: number | null): { label: string; color: string } {
  if (hist == null) return { label: "—", color: "text-muted" };
  if (hist > 0) return { label: "Rialzista", color: "text-positive" };
  if (hist < 0) return { label: "Ribassista", color: "text-negative" };
  return { label: "Neutrale", color: "text-muted" };
}

function interpretBB(
  price: number | null,
  upper: number | null,
  lower: number | null
): { label: string; color: string } {
  if (price == null || upper == null || lower == null)
    return { label: "—", color: "text-muted" };
  if (price >= upper) return { label: "Sopra banda sup.", color: "text-negative" };
  if (price <= lower) return { label: "Sotto banda inf.", color: "text-positive" };
  return { label: "Dentro le bande", color: "text-muted" };
}

export default function SignalsPanel({ signals }: Props) {
  const { last, rsi, macd_hist, bbands, atr, stoch, adx, obv, williams_r } = signals;

  const rsiSignal = interpretRsi(last.rsi);
  const macdSignal = interpretMacd(last.macd_hist);
  const bbSignal = interpretBB(last.price, last.bb_upper, last.bb_lower);

  return (
    <div className="space-y-4">
      {/* Riepilogo segnali */}
      <div className="bg-card border border-border rounded-xl p-4 grid grid-cols-5 gap-4">
        <div>
          <span className="text-muted text-xs uppercase">RSI (14)</span>
          <p className="text-white font-semibold">{last.rsi?.toFixed(1) ?? "—"}</p>
          <p className={`text-sm ${rsiSignal.color}`}>{rsiSignal.label}</p>
        </div>
        <div>
          <span className="text-muted text-xs uppercase">MACD</span>
          <p className="text-white font-semibold">{last.macd_hist?.toFixed(3) ?? "—"}</p>
          <p className={`text-sm ${macdSignal.color}`}>{macdSignal.label}</p>
        </div>
        <div>
          <span className="text-muted text-xs uppercase">Bollinger (20)</span>
          <p className="text-white font-semibold">
            {last.bb_upper != null ? `$${last.bb_upper.toFixed(1)}` : "—"}
          </p>
          <p className={`text-sm ${bbSignal.color}`}>{bbSignal.label}</p>
        </div>
        <div>
          <span className="text-muted text-xs uppercase">ATR (14)</span>
          <p className="text-white font-semibold">
            {last.atr != null ? `$${last.atr.toFixed(2)}` : "—"}
          </p>
          <p className="text-muted text-sm">Volatilità</p>
        </div>
        <div>
          <span className="text-muted text-xs uppercase">Stochastic K</span>
          <p className="text-white font-semibold">
            {last.stoch_k != null ? last.stoch_k.toFixed(1) : "—"}
          </p>
          {last.stoch_k != null && (
            <p
              className={`text-sm ${
                last.stoch_k >= 80
                  ? "text-negative"
                  : last.stoch_k <= 20
                  ? "text-positive"
                  : "text-muted"
              }`}
            >
              {last.stoch_k >= 80
                ? "Ipercomprato"
                : last.stoch_k <= 20
                ? "Ipervenduto"
                : "Neutrale"}
            </p>
          )}
        </div>
      </div>

      {/* RSI */}
      {rsi.length > 0 && (
        <IndicatorChart
          data={rsi}
          label="RSI (14)"
          color="#a78bfa"
          referenceLines={[70, 30]}
          domain={[0, 100]}
        />
      )}

      {/* MACD Histogram */}
      {macd_hist.length > 0 && (
        <IndicatorChart
          data={macd_hist}
          label="MACD Histogram"
          color="#3b82f6"
          referenceLines={[0]}
        />
      )}

      {/* Bollinger Bands */}
      {bbands.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <span className="text-muted text-xs uppercase tracking-wide">
            Bollinger Bands (20, 2σ)
          </span>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={bbands}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#6b7280" }}
                tickFormatter={(v) => v.slice(5)}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#6b7280" }}
                domain={["auto", "auto"]}
                tickFormatter={(v) => `$${v.toFixed(0)}`}
              />
              <Tooltip
                contentStyle={{
                  background: "#1a1d27",
                  border: "1px solid #2a2d3a",
                  borderRadius: 8,
                }}
                formatter={(v: number, name: string) => [`$${v.toFixed(2)}`, name]}
              />
              <Line type="monotone" dataKey="upper" stroke="#ef4444" strokeWidth={1} dot={false} isAnimationActive={false} name="Upper" />
              <Line type="monotone" dataKey="middle" stroke="#6b7280" strokeWidth={1} strokeDasharray="4 4" dot={false} isAnimationActive={false} name="SMA20" />
              <Line type="monotone" dataKey="lower" stroke="#22c55e" strokeWidth={1} dot={false} isAnimationActive={false} name="Lower" />
              <Line type="monotone" dataKey="price" stroke="#ffffff" strokeWidth={1.5} dot={false} isAnimationActive={false} name="Prezzo" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ATR */}
      {atr.length > 0 && (
        <IndicatorChart
          data={atr}
          label="ATR (14) — Volatilità in $"
          color="#22c55e"
        />
      )}

      {/* Stochastic K/D */}
      {stoch.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <span className="text-muted text-xs uppercase tracking-wide">
            Stochastic (14, 3)
          </span>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={stoch}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#6b7280" }}
                tickFormatter={(v) => v.slice(5)}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  background: "#1a1d27",
                  border: "1px solid #2a2d3a",
                  borderRadius: 8,
                }}
                formatter={(v: number, name: string) => [v.toFixed(1), name]}
              />
              <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="3 3" />
              <ReferenceLine y={20} stroke="#22c55e" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="k" stroke="#a78bfa" strokeWidth={1.5} dot={false} isAnimationActive={false} name="%K" />
              <Line type="monotone" dataKey="d" stroke="#f59e0b" strokeWidth={1.5} dot={false} isAnimationActive={false} name="%D" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ADX */}
      {adx.length > 0 && (
        <IndicatorChart
          data={adx}
          label="ADX (14) — Forza del trend"
          color="#f59e0b"
          referenceLines={[25]}
          domain={[0, 100]}
        />
      )}

      {/* OBV */}
      {obv.length > 0 && (
        <IndicatorChart
          data={obv}
          label="OBV — On-Balance Volume"
          color="#3b82f6"
        />
      )}

      {/* Williams %R */}
      {williams_r.length > 0 && (
        <IndicatorChart
          data={williams_r}
          label="Williams %R (14)"
          color="#ec4899"
          referenceLines={[-20, -80]}
          domain={[-100, 0]}
        />
      )}
    </div>
  );
}
