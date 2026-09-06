import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ApprovalCard } from "@/components/time-off/approval-card";
import { listMyPayslips } from "@/lib/actions/payslips";
import {
  listMyLeaveBalances,
  listPendingApprovals,
  managerOverviewStats,
} from "@/lib/actions/time-off";
import { requireMembership } from "@/lib/auth/context";
import { buildPayInsights } from "@/lib/domain/insights";
import { formatDays, formatIls, formatPayslipPeriod } from "@/lib/format";

export const metadata: Metadata = {
  title: "Team overview",
};

export default async function ManagerOverviewPage() {
  const ctx = await requireMembership();
  const companyId = ctx.membership.company.id;
  const [stats, pending, myPayslips, myBalances] = await Promise.all([
    managerOverviewStats(ctx.membership.id, companyId),
    listPendingApprovals(ctx.membership.id, companyId),
    listMyPayslips(ctx.membership.id, companyId),
    listMyLeaveBalances(ctx.membership.id, companyId),
  ]);
  const mine = buildPayInsights(
    myPayslips.filter((row) => row.status === "published"),
  );
  const myVacation = myBalances.find((row) => row.code === "vacation");
  const mySick = myBalances.find((row) => row.code === "sick");

  return (
    <>
      <PageHeader
        title="Team overview"
        description="Requests waiting on you, who is away, and leave left on the team."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Waiting on you"
          value={String(stats.pending)}
          hint={stats.pending === 0 ? "Nothing to approve" : "Open Approvals"}
        />
        <StatCard
          label="Direct reports"
          value={String(stats.reports)}
          hint={stats.reports === 0 ? "No one reports to you yet" : "On your team"}
        />
        <StatCard
          label="Away this month"
          value={String(stats.awayThisMonth)}
          hint="Approved leave overlapping this month"
        />
        <StatCard
          label="Team vacation left"
          value={
            stats.vacationRemaining !== null
              ? formatDays(stats.vacationRemaining)
              : "—"
          }
          hint={
            stats.vacationRemaining !== null
              ? "Remaining holidays across direct reports"
              : "No vacation balances yet"
          }
        />
        <StatCard
          label="Team sick left"
          value={
            stats.sickRemaining !== null ? formatDays(stats.sickRemaining) : "—"
          }
          hint={
            stats.sickRemaining !== null
              ? "Remaining sick days across direct reports"
              : "No sick balances yet"
          }
        />
        <StatCard
          label="Team latest net"
          value={
            stats.averageLatestNet !== null
              ? formatIls(stats.averageLatestNet)
              : "—"
          }
          hint={
            stats.averageLatestNet !== null
              ? "Average of each person's last published slip"
              : "No published team slips yet"
          }
        />
      </div>

      <div className="mt-8 space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium text-slate-900">Your numbers</h2>
          <Link
            href="/employee"
            className="text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            Full dashboard
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Last net paid"
            value={mine.latest ? formatIls(mine.latest.netPay) : "—"}
            hint={
              mine.latest
                ? formatPayslipPeriod(mine.latest.year, mine.latest.month)
                : "No pay slips yet"
            }
          />
          <StatCard
            label="Vacation remaining"
            value={myVacation ? formatDays(myVacation.availableDays) : "—"}
            hint={
              myVacation
                ? `${formatDays(myVacation.pendingDays)} pending`
                : "No leave days set"
            }
          />
          <StatCard
            label="Sick remaining"
            value={mySick ? formatDays(mySick.availableDays) : "—"}
            hint={
              mySick
                ? `${formatDays(mySick.pendingDays)} pending`
                : "No leave days set"
            }
          />
        </div>
      </div>

      <div className="mt-8 space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium text-slate-900">
            Pending approvals
          </h2>
          {pending.length > 0 ? (
            <Link
              href="/manager/approvals"
              className="text-xs font-medium text-slate-500 hover:text-slate-900"
            >
              See all
            </Link>
          ) : null}
        </div>
        {pending.length === 0 ? (
          <EmptyState
            title="Nothing is waiting on you"
            description="When someone at this business requests time off, it appears here so you can approve or reject it."
          />
        ) : (
          <div className="space-y-4">
            {pending.slice(0, 3).map((request) => (
              <ApprovalCard key={request.id} request={request} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
