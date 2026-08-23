import type { Metadata } from "next";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { listDirectReportSummaries } from "@/lib/actions/time-off";
import { requireMembership } from "@/lib/auth/context";
import { formatDays } from "@/lib/format";

export const metadata: Metadata = {
  title: "Team",
};

export default async function ManagerTeamPage() {
  const ctx = await requireMembership();
  const reports = await listDirectReportSummaries(
    ctx.membership.id,
    ctx.membership.company.id,
  );

  return (
    <>
      <PageHeader
        title="Team"
        description="People who report to you. Leave and pay files stay on their own pages; this is the planning list."
      />

      {reports.length === 0 ? (
        <EmptyState
          title="No direct reports yet"
          description="When the bookkeeper sets you as someone’s line manager, they appear here."
        />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {reports.map((person) => (
            <li
              key={person.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">
                  {person.fullName}
                </p>
                <p className="text-xs text-slate-500">
                  {[person.jobTitle, person.department].filter(Boolean).join(" · ") ||
                    "No title set"}
                </p>
              </div>
              <p className="shrink-0 text-xs text-slate-600">
                {person.vacationAvailable !== null
                  ? `${formatDays(person.vacationAvailable)} vacation`
                  : "No vacation balance"}
                {person.pendingRequests > 0
                  ? ` · ${person.pendingRequests} pending`
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
