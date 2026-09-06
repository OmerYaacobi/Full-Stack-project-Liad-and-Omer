import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ApprovalCard } from "@/components/time-off/approval-card";
import { listPayrollPeriods } from "@/lib/actions/periods";
import { listFirmPendingApprovals } from "@/lib/actions/time-off";
import { formatPayslipPeriod } from "@/lib/format";

export const metadata: Metadata = {
  title: "What needs attention",
};

export default async function BookkeeperDashboardPage() {
  const [pending, periods] = await Promise.all([
    listFirmPendingApprovals(),
    listPayrollPeriods(),
  ]);
  const unpublished = periods.filter(
    (period) => period.status !== "locked" && period.assignedCount > period.publishedCount,
  );

  return (
    <>
      <PageHeader
        title="What needs attention"
        description="Everything unfinished, in one list."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Time-off to approve"
          value={String(pending.length)}
          hint={pending.length === 0 ? "Nothing waiting" : "Open Approvals"}
        />
        <Link href="/bookkeeper/periods" className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900">
          <StatCard
            label="Unpublished periods"
            value={String(unpublished.length)}
            hint={
              unpublished.length === 0
                ? "Nothing waiting to publish"
                : "Open Payroll periods"
            }
          />
        </Link>
        <StatCard
          label="Missing entitlements"
          value="0"
          hint="Employees without leave days"
        />
      </div>

      <div className="mt-8 space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium text-slate-900">Your queue</h2>
          {pending.length > 0 ? (
            <Link
              href="/bookkeeper/approvals"
              className="text-xs font-medium text-slate-500 hover:text-slate-900"
            >
              See all
            </Link>
          ) : null}
        </div>
        {pending.length === 0 && unpublished.length === 0 ? (
          <EmptyState
            title="Nothing to do yet"
            description="When an employee requests time off, it appears here. Pay slips stay in draft until you publish the month from Payroll periods."
          />
        ) : (
          <div className="space-y-4">
            {unpublished.slice(0, 5).map((period) => {
              const waiting = period.assignedCount - period.publishedCount;
              return (
                <Link
                  key={period.id}
                  href={`/bookkeeper/periods/${period.id}`}
                  className="block rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 hover:border-amber-300"
                >
                  <p className="text-sm font-medium text-amber-950">
                    {period.companyName}
                    <span className="ml-2 font-normal text-amber-800">
                      {formatPayslipPeriod(period.year, period.month)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-amber-800">
                    {waiting} pay slip{waiting === 1 ? "" : "s"} waiting to publish
                  </p>
                </Link>
              );
            })}
            {pending.slice(0, 5).map((request) => (
              <ApprovalCard key={request.id} request={request} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
