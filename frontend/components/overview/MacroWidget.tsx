interface Props {
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
}

export default function MacroWidget({ label, value, change, positive }: Props) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
      <span className="text-muted text-xs uppercase tracking-wide">{label}</span>
      <span className="text-white text-2xl font-semibold">{value}</span>
      {change && (
        <span className={`text-sm ${positive ? "text-positive" : "text-negative"}`}>
          {change}
        </span>
      )}
    </div>
  );
}
