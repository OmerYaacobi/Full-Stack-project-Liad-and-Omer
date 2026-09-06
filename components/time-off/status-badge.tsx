import type { TimeOffRequest } from "@/lib/actions/time-off";

const STYLES: Record<TimeOffRequest["status"], string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-slate-100 text-slate-600",
};

const LABELS: Record<TimeOffRequest["status"], string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export function RequestStatusBadge({
  status,
}: {
  status: TimeOffRequest["status"];
}) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
