import type { Metadata } from "next";

import { ApprovalCard } from "@/components/time-off/approval-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { listPendingApprovals } from "@/lib/actions/time-off";
import { requireMembership } from "@/lib/auth/context";

export const metadata: Metadata = {
  title: "Approvals",
};

export default async function ManagerApprovalsPage() {
  const ctx = await requireMembership();
  const pending = await listPendingApprovals(
    ctx.membership.id,
    ctx.membership.company.id,
  );

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Time-off requests from people who report to you. A warning appears when someone else on the team is already away."
      />

      {pending.length === 0 ? (
        <EmptyState
          title="Nothing is waiting on you"
          description="When a direct report requests time off, it shows up here. Assign yourself as their line manager on the business roster if you expect to see someone."
        />
      ) : (
        <div className="space-y-4">
          {pending.map((request) => (
            <ApprovalCard key={request.id} request={request} />
          ))}
        </div>
      )}
    </>
  );
}
