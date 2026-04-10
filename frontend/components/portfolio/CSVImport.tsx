"use client";

import { useState, useCallback } from "react";
import { parseCSV } from "@/lib/portfolio";
import type { PortfolioRow } from "@/types/openbb";

interface Props {
  onImport: (rows: PortfolioRow[]) => void;
}

export default function CSVImport({ onImport }: Props) {
  const [errors, setErrors] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  function processFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { rows, errors: parseErrors } = parseCSV(text);
      if (parseErrors.length > 0) {
        setErrors(parseErrors);
      } else {
        setErrors([]);
        onImport(rows);
      }
    };
    reader.readAsText(file);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".csv")) processFile(file);
  }, []);

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          isDragging ? "border-accent bg-accent/5" : "border-border"
        }`}
      >
        <p className="text-muted text-sm mb-2">Trascina un file CSV oppure</p>
        <label className="cursor-pointer">
          <span className="bg-accent hover:bg-accent/80 text-white text-sm px-4 py-2 rounded-lg transition-colors">
            Scegli file
          </span>
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) processFile(file);
            }}
          />
        </label>
        <p className="text-muted text-xs mt-3">
          Formato: <code className="text-white">ticker, quantity, buy_price, buy_date</code>
        </p>
      </div>

      {errors.length > 0 && (
        <div className="bg-negative/10 border border-negative/30 rounded-lg p-3 space-y-1">
          <p className="text-negative text-sm font-medium">Errori nel file CSV:</p>
          {errors.map((err, i) => (
            <p key={i} className="text-negative text-xs">{err}</p>
          ))}
        </div>
      )}
    </div>
  );
}
