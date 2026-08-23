import type { Metadata } from "next";
import Link from "next/link";

import { DocumentFolders } from "@/components/documents/document-folders";
import { PayslipList } from "@/components/payslips/payslip-list";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { LeaveBalanceCards } from "@/components/time-off/balance-cards";
import { listMyDocuments } from "@/lib/actions/documents";
import { listMyPayslips } from "@/lib/actions/payslips";
import { listMyLeaveBalances } from "@/lib/actions/time-off";
import { formatDays, formatIls, formatPayslipPeriod } from "@/lib/format";
import { requireMembership } from "@/lib/auth/context";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function EmployeeDashboardPage() {
  const ctx = await requireMembership();
  const firstName = ctx.profile?.fullName?.split(" ")[0];
  const [{ personal }, payslips, balances] = await Promise.all([
    listMyDocuments(ctx.membership.id, ctx.membership.company.id),
    listMyPayslips(ctx.membership.id, ctx.membership.company.id),
    listMyLeaveBalances(ctx.membership.id, ctx.membership.company.id),
  ]);
  const vacation = balances.find((row) => row.code === "vacation");
  const recent = personal.slice(0, 5);
  const latest = payslips[0];
  const lastTwelve = payslips.slice(0, 12);
  const averageNet =
    lastTwelve.length >= 3
      ? lastTwelve.reduce((sum, row) => sum + row.netPay, 0) / lastTwelve.length
      : null;
  const deductionRate =
    latest && latest.grossPay > 0
      ? Math.round((latest.totalDeductions / latest.grossPay) * 100)
      : null;

  return (
    <>
      <PageHeader
        title={firstName ? `Hello, ${firstName}` : "Your dashboard"}
        description="Your pay, your deductions, and your leave balance."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Latest net pay"
          value={latest ? formatIls(latest.netPay) : "—"}
          hint={
            latest
              ? formatPayslipPeriod(latest.year, latest.month)
              : "No pay slips yet"
          }
        />
        <StatCard
          label="Average net (12mo)"
          value={averageNet !== null ? formatIls(averageNet) : "—"}
          hint={
            averageNet !== null
              ? `${lastTwelve.length} months`
              : "Needs 3 months"
          }
        />
        <StatCard
          label="Deduction rate"
          value={deductionRate !== null ? `${deductionRate}%` : "—"}
          hint={latest ? "Of latest gross" : "No pay slips yet"}
        />
        <StatCard
          label="Vacation available"
          value={vacation ? formatDays(vacation.availableDays) : "—"}
          hint={
            vacation
              ? `${formatDays(vacation.pendingDays)} pending`
              : "No leave days set"
          }
        />
      </div>

      <div className="mt-8 space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium text-slate-900">Documents</h2>
          <Link
            href="/employee/documents"
            className="text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            See all
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState
            title="No documents yet"
            description="When your bookkeeper files a form or contract for you, it appears here."
          />
        ) : (
          <DocumentFolders documents={recent} />
        )}
      </div>

      <div className="mt-8 space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium text-slate-900">Recent pay slips</h2>
          <Link
            href="/employee/payslips"
            className="text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            See all
          </Link>
        </div>
        <PayslipList
          payslips={payslips.slice(0, 3)}
          emptyTitle="No pay slips yet"
          emptyDescription="Your first pay slip will appear here once your bookkeeper publishes it."
        />
      </div>

      <div className="mt-8 space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium text-slate-900">Leave balance</h2>
          <Link
            href="/employee/time-off"
            className="text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            Request time off
          </Link>
        </div>
        <LeaveBalanceCards balances={balances} />
      </div>
    </>
  );
}
