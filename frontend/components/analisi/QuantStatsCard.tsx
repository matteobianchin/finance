interface Props {
  label: string;
  value: string;
  color?: string;
  subtext?: string;
}

export default function QuantStatsCard({ label, value, color = "text-white", subtext }: Props) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-muted text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {subtext && <p className="text-muted text-xs mt-1">{subtext}</p>}
    </div>
  );
}
