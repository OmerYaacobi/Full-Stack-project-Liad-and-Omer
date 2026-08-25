import type { Metadata } from "next";
import Link from "next/link";

import { ClaimDirectReportForm } from "@/components/employees/claim-direct-report-form";
import { OutgoingTeamJoinList } from "@/components/employees/outgoing-team-join-list";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import {
  getMyEmployeeId,
  listClaimableTeammates,
  listOutgoingTeamJoinRequests,
} from "@/lib/actions/employees";
import { listDirectReportSummaries } from "@/lib/actions/time-off";
import { requireMembership } from "@/lib/auth/context";
import { formatDays, formatIls, formatPayslipPeriod } from "@/lib/format";

export const metadata: Metadata = {
  title: "Team",
};

export default async function ManagerTeamPage() {
  const ctx = await requireMembership();
  const companyId = ctx.membership.company.id;
  const managerId = await getMyEmployeeId(ctx.membership.id);
  const [reports, claimable, outgoing] = await Promise.all([
    listDirectReportSummaries(ctx.membership.id, companyId),
    managerId ? listClaimableTeammates(companyId, managerId) : Promise.resolve([]),
    managerId
      ? listOutgoingTeamJoinRequests(managerId)
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title="Team"
        description="People who report to you: last take-home, typical net, and remaining leave."
      />

      {reports.length === 0 ? (
        <EmptyState
          title="No direct reports yet"
          description="Ask someone from the company team below. They have to accept before they report to you."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Last net</th>
                <th className="px-4 py-2.5">Average net</th>
                <th className="px-4 py-2.5">Vacation</th>
                <th className="px-4 py-2.5">Sick</th>
                <th className="px-4 py-2.5">Pending</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map((person) => (
                <tr key={person.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/manager/team/${person.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {person.fullName}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {[person.jobTitle, person.department].filter(Boolean).join(" · ") ||
                        "No title set"}
                    </p>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">
                    {person.latestNet !== null ? formatIls(person.latestNet) : "—"}
                    {person.latestYear && person.latestMonth ? (
                      <p className="text-xs text-slate-500">
                        {formatPayslipPeriod(person.latestYear, person.latestMonth)}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">
                    {person.averageNet !== null ? formatIls(person.averageNet) : "—"}
                    <p className="text-xs text-slate-500">
                      {person.averageNet !== null ? "Last 12 months" : "Needs 3 months"}
                    </p>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">
                    {person.vacationAvailable !== null
                      ? formatDays(person.vacationAvailable)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">
                    {person.sickAvailable !== null
                      ? formatDays(person.sickAvailable)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {person.pendingRequests > 0
                      ? `${person.pendingRequests} request${person.pendingRequests === 1 ? "" : "s"}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 space-y-4">
        <OutgoingTeamJoinList requests={outgoing} />
        <ClaimDirectReportForm teammates={claimable} />
      </div>
    </>
  );
}
