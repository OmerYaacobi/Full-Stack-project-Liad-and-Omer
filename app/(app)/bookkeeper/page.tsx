import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ApprovalCard } from "@/components/time-off/approval-card";
import { listFirmPendingApprovals } from "@/lib/actions/time-off";

export const metadata: Metadata = {
  title: "What needs attention",
};

export default async function BookkeeperDashboardPage() {
  const pending = await listFirmPendingApprovals();

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
        <StatCard
          label="Unpublished periods"
          value="0"
          hint="Nothing in draft"
        />
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
        {pending.length === 0 ? (
          <EmptyState
            title="Nothing to do yet"
            description="When an employee requests time off, it appears here. Pay slips still need to be uploaded and published from each business."
          />
        ) : (
          <div className="space-y-4">
            {pending.slice(0, 5).map((request) => (
              <ApprovalCard key={request.id} request={request} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
