import type { IncomeStatement } from "@/types/openbb";

interface Props {
  data: IncomeStatement[];
}

function fmt(v: number | null): string {
  if (v === null) return "—";
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toFixed(2)}`;
}

export default function FundamentalsTable({ data }: Props) {
  if (!data.length) return <p className="text-muted text-sm">Dati non disponibili.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted border-b border-border">
            <th className="text-left py-2 pr-4">Anno</th>
            <th className="text-right py-2 pr-4">Revenue</th>
            <th className="text-right py-2 pr-4">Utile netto</th>
            <th className="text-right py-2 pr-4">EPS</th>
            <th className="text-right py-2">EBITDA</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.date} className="border-b border-border/50 hover:bg-white/5">
              <td className="py-2 pr-4 text-white">{row.date.slice(0, 4)}</td>
              <td className="py-2 pr-4 text-right">{fmt(row.revenue)}</td>
              <td className={`py-2 pr-4 text-right ${(row.net_income ?? 0) >= 0 ? "text-positive" : "text-negative"}`}>
                {fmt(row.net_income)}
              </td>
              <td className="py-2 pr-4 text-right">{row.eps?.toFixed(2) ?? "—"}</td>
              <td className="py-2 text-right">{fmt(row.ebitda)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
