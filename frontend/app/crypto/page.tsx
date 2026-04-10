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
        <p className="text-muted text-sm">Caricamento...</p>
      ) : (
        <CryptoTable data={data} />
      )}
    </div>
  );
}
