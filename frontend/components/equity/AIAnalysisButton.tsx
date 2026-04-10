"use client";

import { BrainCircuit } from "lucide-react";

/**
 * Placeholder per analisi AI — abilitato in v2 quando ANTHROPIC_API_KEY è configurato.
 * In v1 mostra il pulsante disabilitato con tooltip esplicativo.
 */
export default function AIAnalysisButton() {
  return (
    <div className="relative group">
      <button
        disabled
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border text-muted cursor-not-allowed opacity-60 text-sm"
        aria-label="Analisi AI — disponibile in v2"
      >
        <BrainCircuit size={16} />
        Analisi AI
        <span className="text-xs bg-border px-1.5 py-0.5 rounded">v2</span>
      </button>
      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-card border border-border rounded-lg p-2 text-xs text-muted w-56 z-10">
        Disponibile nella prossima versione. Analizzerà prezzi, indicatori e news con Claude AI.
      </div>
    </div>
  );
}
