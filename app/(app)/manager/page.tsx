import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ApprovalCard } from "@/components/time-off/approval-card";
import { listPendingApprovals, managerOverviewStats } from "@/lib/actions/time-off";
import { requireMembership } from "@/lib/auth/context";

export const metadata: Metadata = {
  title: "Team overview",
};

export default async function ManagerOverviewPage() {
  const ctx = await requireMembership();
  const companyId = ctx.membership.company.id;
  const [stats, pending] = await Promise.all([
    managerOverviewStats(ctx.membership.id, companyId),
    listPendingApprovals(ctx.membership.id, companyId),
  ]);

  return (
    <>
      <PageHeader
        title="Team overview"
        description="Requests waiting on you, and who is away."
      />

      <div className="grid gap-4 sm:grid-cols-3">
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
            description="Time-off requests from your direct reports appear here, with a warning when someone else on the team is already away on those dates."
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
