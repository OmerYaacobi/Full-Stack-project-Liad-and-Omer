export function StatCard({
  label,
  value,
  hint,
  delta,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: { label: string; direction: "up" | "down" | "flat" };
}) {
  const deltaClass =
    delta?.direction === "up"
      ? "text-emerald-700"
      : delta?.direction === "down"
        ? "text-rose-700"
        : "text-slate-500";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
        {value}
      </p>
      {delta ? (
        <p className={`mt-1 text-xs ${deltaClass}`}>{delta.label}</p>
      ) : null}
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
