import type { Metadata } from "next";

import { ApprovalCard } from "@/components/time-off/approval-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { listFirmPendingApprovals } from "@/lib/actions/time-off";

export const metadata: Metadata = {
  title: "Approvals",
};

export default async function BookkeeperApprovalsPage() {
  const pending = await listFirmPendingApprovals();
  const groups = groupByCompany(pending);

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Time-off requests from every business you manage. Approve or reject them here, including when nobody is assigned as line manager."
      />

      {pending.length === 0 ? (
        <EmptyState
          title="Nothing is waiting"
          description="When an employee requests vacation or sick leave, it shows up here for you and their manager."
        />
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.companyId} className="space-y-4">
              {groups.length > 1 ? (
                <h2 className="text-sm font-medium text-slate-900">
                  {group.companyName}
                </h2>
              ) : null}
              {group.requests.map((request) => (
                <ApprovalCard key={request.id} request={request} />
              ))}
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function groupByCompany(
  pending: Awaited<ReturnType<typeof listFirmPendingApprovals>>,
) {
  const order: string[] = [];
  const map = new Map<
    string,
    { companyId: string; companyName: string; requests: typeof pending }
  >();
  for (const request of pending) {
    const existing = map.get(request.companyId);
    if (existing) {
      existing.requests.push(request);
      continue;
    }
    order.push(request.companyId);
    map.set(request.companyId, {
      companyId: request.companyId,
      companyName: request.companyName ?? "Business",
      requests: [request],
    });
  }
  return order.map((id) => map.get(id)!);
}
