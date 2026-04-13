"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import IndicatorChart from "@/components/charts/IndicatorChart";
import SectionToggle from "@/components/ui/SectionToggle";
import type { SignalsResult } from "@/types/openbb";

interface Props {
  signals: SignalsResult;
}

// ── Interpretation helpers ────────────────────────────────────────────────────

function badge(value: number | null, thresholds: {
  overbought: number; oversold: number; label?: [string, string, string]
}): { label: string; color: string } {
  const [ob, os] = [thresholds.overbought, thresholds.oversold];
  const [lOb, lNt, lOs] = thresholds.label ?? ["Ipercomprato", "Neutrale", "Ipervenduto"];
  if (value == null) return { label: "—", color: "text-muted" };
  if (value >= ob) return { label: lOb, color: "text-negative" };
  if (value <= os) return { label: lOs, color: "text-positive" };
  return { label: lNt, color: "text-muted" };
}

function macdBadge(hist: number | null) {
  if (hist == null) return { label: "—", color: "text-muted" };
  if (hist > 0) return { label: "Rialzista", color: "text-positive" };
  if (hist < 0) return { label: "Ribassista", color: "text-negative" };
  return { label: "Neutrale", color: "text-muted" };
}

function bbBadge(price: number | null, upper: number | null, lower: number | null) {
  if (price == null || upper == null || lower == null) return { label: "—", color: "text-muted" };
  if (price >= upper) return { label: "Sopra banda sup.", color: "text-negative" };
  if (price <= lower) return { label: "Sotto banda inf.", color: "text-positive" };
  return { label: "Dentro le bande", color: "text-muted" };
}

function aroonBadge(up: number | null, down: number | null) {
  if (up == null || down == null) return { label: "—", color: "text-muted" };
  if (up > 70 && down < 30) return { label: "Uptrend forte", color: "text-positive" };
  if (down > 70 && up < 30) return { label: "Downtrend forte", color: "text-negative" };
  return { label: "Indeciso", color: "text-muted" };
}

// ── Tooltip style ─────────────────────────────────────────────────────────────

const ttStyle = {
  background: "#1a1d27",
  border: "1px solid #2a2d3a",
  borderRadius: 8,
};

const axisProps = {
  tick: { fontSize: 10, fill: "#6b7280" },
  interval: "preserveStartEnd" as const,
};

function xFormatter(v: string) { return v.slice(5); }

// ── Band chart (BBands / Donchian / Keltner) ──────────────────────────────────

function BandChart({
  data, label,
  upperColor = "#ef4444", middleColor = "#6b7280", lowerColor = "#22c55e",
}: {
  data: { date: string; upper: number; middle: number | null; lower: number | null; price: number }[];
  label: string;
  upperColor?: string;
  middleColor?: string;
  lowerColor?: string;
}) {
  if (!data.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <span className="text-muted text-xs uppercase tracking-wide">{label}</span>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
          <XAxis dataKey="date" {...axisProps} tickFormatter={xFormatter} />
          <YAxis tick={axisProps.tick} domain={["auto", "auto"]} tickFormatter={(v) => `$${v.toFixed(0)}`} />
          <Tooltip contentStyle={ttStyle} formatter={(v: number, name: string) => [`$${v.toFixed(2)}`, name]} />
          <Line type="monotone" dataKey="upper"  stroke={upperColor}  strokeWidth={1}   dot={false} isAnimationActive={false} name="Upper" />
          <Line type="monotone" dataKey="middle" stroke={middleColor} strokeWidth={1}   strokeDasharray="4 4" dot={false} isAnimationActive={false} name="Middle" />
          <Line type="monotone" dataKey="lower"  stroke={lowerColor}  strokeWidth={1}   dot={false} isAnimationActive={false} name="Lower" />
          <Line type="monotone" dataKey="price"  stroke="#ffffff"     strokeWidth={1.5} dot={false} isAnimationActive={false} name="Prezzo" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Summary stat cell ─────────────────────────────────────────────────────────

function StatCell({ label, value, sub, subColor }: {
  label: string; value: string; sub: string; subColor: string;
}) {
  return (
    <div>
      <span className="text-muted text-xs uppercase">{label}</span>
      <p className="text-white font-semibold">{value}</p>
      <p className={`text-sm ${subColor}`}>{sub}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SignalsPanel({ signals }: Props) {
  const {
    last, rsi, macd_hist, cci, mfi, roc, stoch, williams_r, adx, aroon,
    atr, bbands, donchian, keltner,
    moving_averages,
    obv, ad,
  } = signals;

  const rsiSig    = badge(last.rsi,        { overbought: 70, oversold: 30 });
  const cciSig    = badge(last.cci,        { overbought: 100, oversold: -100 });
  const mfiSig    = badge(last.mfi,        { overbought: 80, oversold: 20 });
  const stochSig  = badge(last.stoch_k,    { overbought: 80, oversold: 20 });
  const wrSig     = badge(last.williams_r, { overbought: -20, oversold: -80 });
  const macdSig   = macdBadge(last.macd_hist);
  const bbSig     = bbBadge(last.price, last.bb_upper, last.bb_lower);
  const aroonSig  = aroonBadge(last.aroon_up, last.aroon_down);

  const fmt = (v: number | null, decimals = 1) => v != null ? v.toFixed(decimals) : "—";
  const fmtDollar = (v: number | null) => v != null ? `$${v.toFixed(2)}` : "—";
  const fmtPct = (v: number | null) => v != null ? `${v.toFixed(2)}%` : "—";

  return (
    <div className="space-y-5">

      {/* ── Riepilogo (sempre visibile) ── */}
      <div className="grid grid-cols-5 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <StatCell label="RSI (14)"     value={fmt(last.rsi)}           sub={rsiSig.label}   subColor={rsiSig.color} />
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <StatCell label="MACD"         value={fmt(last.macd_hist, 3)}  sub={macdSig.label}  subColor={macdSig.color} />
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <StatCell label="Bollinger"    value={fmtDollar(last.bb_upper)} sub={bbSig.label}   subColor={bbSig.color} />
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <StatCell label="ATR (14)"     value={fmtDollar(last.atr)}     sub="Volatilità"     subColor="text-muted" />
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <StatCell label="Stoch %K"     value={fmt(last.stoch_k)}       sub={stochSig.label} subColor={stochSig.color} />
        </div>
      </div>
      <div className="grid grid-cols-5 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <StatCell label="CCI (20)"     value={fmt(last.cci)}           sub={cciSig.label}   subColor={cciSig.color} />
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <StatCell label="MFI (14)"     value={fmt(last.mfi)}           sub={mfiSig.label}   subColor={mfiSig.color} />
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <StatCell label="ROC (12)"     value={fmtPct(last.roc)}        sub={last.roc != null && last.roc > 0 ? "Positivo" : "Negativo"} subColor={last.roc != null && last.roc > 0 ? "text-positive" : "text-negative"} />
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <StatCell label="Williams %R"  value={fmt(last.williams_r)}    sub={wrSig.label}    subColor={wrSig.color} />
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <StatCell label="Aroon"        value={`↑${fmt(last.aroon_up)} ↓${fmt(last.aroon_down)}`} sub={aroonSig.label} subColor={aroonSig.color} />
        </div>
      </div>

      {/* ── Oscillatori ── */}
      <SectionToggle title="Oscillatori" badge="RSI · CCI · MFI · Stoch · W%R">
        {rsi.length > 0 && (
          <IndicatorChart data={rsi} label="RSI (14)" color="#a78bfa"
            referenceLines={[70, 30]} domain={[0, 100]} />
        )}
        {cci.length > 0 && (
          <IndicatorChart data={cci} label="CCI (20) — Commodity Channel Index"
            color="#f97316" referenceLines={[100, -100]} />
        )}
        {mfi.length > 0 && (
          <IndicatorChart data={mfi} label="MFI (14) — Money Flow Index"
            color="#06b6d4" referenceLines={[80, 20]} domain={[0, 100]} />
        )}
        {stoch.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <span className="text-muted text-xs uppercase tracking-wide">Stochastic (14, 3)</span>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={stoch}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
                <XAxis dataKey="date" {...axisProps} tickFormatter={xFormatter} />
                <YAxis tick={axisProps.tick} domain={[0, 100]} />
                <Tooltip contentStyle={ttStyle} formatter={(v: number, name: string) => [v.toFixed(1), name]} />
                <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="3 3" />
                <ReferenceLine y={20} stroke="#22c55e" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="k" stroke="#a78bfa" strokeWidth={1.5} dot={false} isAnimationActive={false} name="%K" />
                <Line type="monotone" dataKey="d" stroke="#f59e0b" strokeWidth={1.5} dot={false} isAnimationActive={false} name="%D" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {williams_r.length > 0 && (
          <IndicatorChart data={williams_r} label="Williams %R (14)"
            color="#ec4899" referenceLines={[-20, -80]} domain={[-100, 0]} />
        )}
      </SectionToggle>

      {/* ── Trend & Momentum ── */}
      <SectionToggle title="Trend & Momentum" badge="MA · MACD · ROC · ADX · Aroon">
        {moving_averages.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <span className="text-muted text-xs uppercase tracking-wide">
              Moving Averages (SMA 20/50/200 · EMA 9/21/50/200 · VWAP)
            </span>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={moving_averages}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
                <XAxis dataKey="date" {...axisProps} tickFormatter={xFormatter} />
                <YAxis tick={axisProps.tick} domain={["auto", "auto"]} tickFormatter={(v) => `$${v.toFixed(0)}`} />
                <Tooltip contentStyle={ttStyle} formatter={(v: number, name: string) => [`$${v.toFixed(2)}`, name]} />
                <Line type="monotone" dataKey="price"  stroke="#ffffff" strokeWidth={1.5} dot={false} isAnimationActive={false} name="Prezzo" />
                <Line type="monotone" dataKey="sma20"  stroke="#3b82f6" strokeWidth={1}   dot={false} isAnimationActive={false} name="SMA20"  strokeDasharray="4 2" />
                <Line type="monotone" dataKey="sma50"  stroke="#8b5cf6" strokeWidth={1}   dot={false} isAnimationActive={false} name="SMA50"  strokeDasharray="4 2" />
                <Line type="monotone" dataKey="sma200" stroke="#f59e0b" strokeWidth={1}   dot={false} isAnimationActive={false} name="SMA200" strokeDasharray="4 2" />
                <Line type="monotone" dataKey="ema9"   stroke="#22c55e" strokeWidth={1}   dot={false} isAnimationActive={false} name="EMA9" />
                <Line type="monotone" dataKey="ema21"  stroke="#10b981" strokeWidth={1}   dot={false} isAnimationActive={false} name="EMA21" />
                <Line type="monotone" dataKey="ema50"  stroke="#06b6d4" strokeWidth={1}   dot={false} isAnimationActive={false} name="EMA50" />
                <Line type="monotone" dataKey="ema200" stroke="#ec4899" strokeWidth={1}   dot={false} isAnimationActive={false} name="EMA200" />
                <Line type="monotone" dataKey="vwap"   stroke="#fbbf24" strokeWidth={1.5} dot={false} isAnimationActive={false} name="VWAP"   strokeDasharray="6 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {macd_hist.length > 0 && (
          <IndicatorChart data={macd_hist} label="MACD Histogram (12, 26, 9)"
            color="#3b82f6" referenceLines={[0]} />
        )}
        {roc.length > 0 && (
          <IndicatorChart data={roc} label="ROC (12) — Rate of Change %"
            color="#84cc16" referenceLines={[0]} />
        )}
        {adx.length > 0 && (
          <IndicatorChart data={adx} label="ADX (14) — Forza del trend"
            color="#f59e0b" referenceLines={[25]} domain={[0, 100]} />
        )}
        {aroon.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <span className="text-muted text-xs uppercase tracking-wide">Aroon (25)</span>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={aroon}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
                <XAxis dataKey="date" {...axisProps} tickFormatter={xFormatter} />
                <YAxis tick={axisProps.tick} domain={[0, 100]} />
                <Tooltip contentStyle={ttStyle} formatter={(v: number, name: string) => [v.toFixed(1), name]} />
                <ReferenceLine y={70} stroke="#6b7280" strokeDasharray="3 3" />
                <ReferenceLine y={30} stroke="#6b7280" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="up"   stroke="#22c55e" strokeWidth={1.5} dot={false} isAnimationActive={false} name="Aroon Up" />
                <Line type="monotone" dataKey="down" stroke="#ef4444" strokeWidth={1.5} dot={false} isAnimationActive={false} name="Aroon Down" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionToggle>

      {/* ── Bande & Volatilità ── */}
      <SectionToggle title="Bande & Volatilità" badge="BBands · ATR · Donchian · Keltner" defaultOpen={false}>
        <BandChart data={bbands} label="Bollinger Bands (20, 2σ)" />
        {atr.length > 0 && (
          <IndicatorChart data={atr} label="ATR (14) — Volatilità in $" color="#22c55e" />
        )}
        <BandChart data={donchian} label="Donchian Channels (20)"
          upperColor="#f97316" middleColor="#6b7280" lowerColor="#3b82f6" />
        <BandChart data={keltner} label="Keltner Channels (20, 2×ATR)"
          upperColor="#a78bfa" middleColor="#6b7280" lowerColor="#10b981" />
      </SectionToggle>

      {/* ── Volume ── */}
      <SectionToggle title="Volume" badge="OBV · A/D" defaultOpen={false}>
        {obv.length > 0 && (
          <IndicatorChart data={obv} label="OBV — On-Balance Volume" color="#3b82f6" />
        )}
        {ad.length > 0 && (
          <IndicatorChart data={ad} label="A/D Line — Accumulation/Distribution" color="#8b5cf6" />
        )}
      </SectionToggle>

    </div>
  );
}
