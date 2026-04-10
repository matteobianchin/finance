"use client";

import { useState } from "react";
import { BrainCircuit, X, Loader2 } from "lucide-react";

interface Props {
  ticker: string;
  price: number;
  change: number;
  rsi?: number;
  macd?: number;
  atrVal?: number;
}

export default function AIAnalysisPanel({
  ticker, price, change, rsi, macd, atrVal,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  async function run() {
    setOpen(true);
    setLoading(true);
    setText("");
    setError("");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          price: price.toFixed(2),
          change: change.toFixed(2),
          rsi,
          macd,
          atrVal,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setText((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={run}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border text-white hover:border-accent transition-colors text-sm"
      >
        <BrainCircuit size={16} className="text-accent" />
        Analisi AI
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <BrainCircuit size={18} className="text-accent" />
                <span className="text-white font-semibold">
                  Analisi AI — {ticker}
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-muted hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {loading && !text && (
              <div className="flex items-center gap-2 text-muted">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Analisi in corso...</span>
              </div>
            )}

            {error && <p className="text-negative text-sm">Errore: {error}</p>}

            {text && (
              <div className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap">
                {text}
                {loading && <span className="animate-pulse">▊</span>}
              </div>
            )}

            <p className="text-muted text-xs mt-4 border-t border-border pt-3">
              Powered by Claude AI · Solo a scopo informativo, non costituisce
              consulenza finanziaria.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
