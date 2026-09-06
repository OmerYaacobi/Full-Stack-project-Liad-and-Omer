export function PeriodStatusBadge({
  status,
}: {
  status: "draft" | "published" | "locked";
}) {
  const styles = {
    draft: "bg-amber-100 text-amber-800",
    published: "bg-emerald-100 text-emerald-800",
    locked: "bg-slate-200 text-slate-700",
  } as const;
  const labels = {
    draft: "Draft",
    published: "Published",
    locked: "Locked",
  } as const;

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
