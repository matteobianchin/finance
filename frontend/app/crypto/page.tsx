"use client";

import { useEffect, useState } from "react";
import CryptoTable from "@/components/crypto/CryptoTable";
import { getCryptoTop10 } from "@/lib/openbb";
import type { Quote } from "@/types/openbb";

export default function CryptoPage() {
  const [data, setData] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCryptoTop10()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-bold text-white">Crypto</h1>
      {error && (
        <div className="bg-negative/10 border border-negative/30 rounded-lg p-3 text-negative text-sm">
          Dati non disponibili: {error}
        </div>
      )}
      {loading ? (
        <div className="bg-card border border-border rounded-xl overflow-hidden animate-pulse">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 border-b border-border/50">
              <div className="h-4 w-4 bg-border rounded" />
              <div className="h-4 w-16 bg-border rounded" />
              <div className="ml-auto h-4 w-20 bg-border rounded" />
              <div className="h-4 w-14 bg-border rounded" />
            </div>
          ))}
        </div>
      ) : (
        <CryptoTable data={data} />
      )}
    </div>
  );
}
