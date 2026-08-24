import type { Metadata } from "next";
import Link from "next/link";

import { DocumentFolders } from "@/components/documents/document-folders";
import { NetPayTrend } from "@/components/insights/net-pay-trend";
import { PayInsightCards } from "@/components/insights/pay-insight-cards";
import { PayslipList } from "@/components/payslips/payslip-list";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { LeaveBalanceCards } from "@/components/time-off/balance-cards";
import { listMyDocuments } from "@/lib/actions/documents";
import { listMyPayslips } from "@/lib/actions/payslips";
import { listMyLeaveBalances } from "@/lib/actions/time-off";
import { requireMembership } from "@/lib/auth/context";
import { buildPayInsights } from "@/lib/domain/insights";

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
  const insights = buildPayInsights(
    payslips.filter((row) => row.status === "published"),
  );
  const vacation = balances.find((row) => row.code === "vacation");
  const sick = balances.find((row) => row.code === "sick");
  const recent = personal.slice(0, 5);

  return (
    <>
      <PageHeader
        title={firstName ? `Hello, ${firstName}` : "Your dashboard"}
        description="Last take-home, how it compares, and the leave you still have."
      />

      <PayInsightCards insights={insights} vacation={vacation} sick={sick} />

      {insights.months.length >= 2 ? (
        <div className="mt-8">
          <NetPayTrend months={insights.months} />
        </div>
      ) : payslips.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No pay history yet"
            description="Your first pay slip will appear here once your bookkeeper publishes it. Leave balances below are already live."
          />
        </div>
      ) : null}

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
    </>
  );
}
