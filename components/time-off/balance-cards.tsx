import type { LeaveBalance } from "@/lib/actions/time-off";
import { formatDays } from "@/lib/format";
import { EmptyState } from "@/components/shared/empty-state";

export function LeaveBalanceCards({ balances }: { balances: LeaveBalance[] }) {
  if (balances.length === 0) {
    return (
      <EmptyState
        title="No leave types configured"
        description="Once your bookkeeper sets up leave entitlements, your balance and request history show up here."
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {balances.map((balance) => (
        <article
          key={balance.leaveTypeId}
          className="rounded-xl border border-slate-200 bg-white p-4"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {balance.name}
          </p>
          {balance.tracksBalance ? (
            <>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
                {formatDays(balance.availableDays)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {formatDays(balance.entitledDays)} entitled ·{" "}
                {formatDays(balance.usedDays)} used ·{" "}
                {formatDays(balance.pendingDays)} pending
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                Calendar
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Does not draw down vacation. Used to mark days away.
              </p>
            </>
          )}
        </article>
      ))}
    </div>
  );
}
