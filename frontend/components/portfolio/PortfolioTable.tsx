import type { PortfolioPosition } from "@/types/openbb";

interface Props {
  positions: PortfolioPosition[];
}

function fmt(v: number): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PortfolioTable({ positions }: Props) {
  const totalValue = positions.reduce((s, p) => s + p.current_value, 0);
  const totalCost = positions.reduce((s, p) => s + p.cost_basis, 0);
  const totalGL = totalValue - totalCost;
  const totalGLPct = totalCost > 0 ? (totalGL / totalCost) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-muted text-xs uppercase">Valore totale</p>
          <p className="text-white text-xl font-bold">{fmt(totalValue)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-muted text-xs uppercase">Costo totale</p>
          <p className="text-white text-xl font-bold">{fmt(totalCost)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-muted text-xs uppercase">P&L totale</p>
          <p className={`text-xl font-bold ${totalGL >= 0 ? "text-positive" : "text-negative"}`}>
            {totalGL >= 0 ? "+" : ""}{fmt(totalGL)}
            <span className="text-sm ml-1">({totalGLPct >= 0 ? "+" : ""}{totalGLPct.toFixed(2)}%)</span>
          </p>
        </div>
      </div>

      {/* Tabella posizioni */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr className="text-muted">
              <th className="text-left p-4">Ticker</th>
              <th className="text-right p-4">Quantità</th>
              <th className="text-right p-4">Prezzo acquisto</th>
              <th className="text-right p-4">Prezzo attuale</th>
              <th className="text-right p-4">Valore</th>
              <th className="text-right p-4">P&L</th>
              <th className="text-right p-4">P&L %</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <tr key={p.ticker} className="border-b border-border/50 hover:bg-white/5">
                <td className="p-4 text-white font-bold">{p.ticker}</td>
                <td className="p-4 text-right">{p.quantity}</td>
                <td className="p-4 text-right">{fmt(p.buy_price)}</td>
                <td className="p-4 text-right">{fmt(p.current_price)}</td>
                <td className="p-4 text-right">{fmt(p.current_value)}</td>
                <td className={`p-4 text-right font-medium ${p.gain_loss >= 0 ? "text-positive" : "text-negative"}`}>
                  {p.gain_loss >= 0 ? "+" : ""}{fmt(p.gain_loss)}
                </td>
                <td className={`p-4 text-right font-medium ${p.gain_loss_pct >= 0 ? "text-positive" : "text-negative"}`}>
                  {p.gain_loss_pct >= 0 ? "+" : ""}{p.gain_loss_pct.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
