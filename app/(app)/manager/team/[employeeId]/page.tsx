import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ApprovalCard } from "@/components/time-off/approval-card";
import { RemoveFromTeamButton } from "@/components/employees/remove-from-team-button";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import {
  listDirectReportSummaries,
  listEmployeePendingApprovals,
} from "@/lib/actions/time-off";
import { requireMembership } from "@/lib/auth/context";
import { formatDays, formatIls, formatPayslipPeriod } from "@/lib/format";

export const metadata: Metadata = {
  title: "Team member",
};

export default async function ManagerTeamMemberPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  const ctx = await requireMembership();
  const companyId = ctx.membership.company.id;
  const [reports, pendingApprovals] = await Promise.all([
    listDirectReportSummaries(ctx.membership.id, companyId),
    listEmployeePendingApprovals(companyId, employeeId),
  ]);
  const person = reports.find((row) => row.id === employeeId);
  if (!person) notFound();

  return (
    <>
      <nav className="mb-4 text-sm text-slate-500">
        <Link href="/manager/team" className="hover:text-slate-900">
          Team
        </Link>
        <span className="mx-2 text-slate-300">/</span>
        <span className="text-slate-700">{person.fullName}</span>
      </nav>

      <PageHeader
        title={person.fullName}
        description={
          [person.jobTitle, person.department].filter(Boolean).join(" · ") ||
          "No title set"
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Last net paid"
          value={person.latestNet !== null ? formatIls(person.latestNet) : "—"}
          hint={
            person.latestYear && person.latestMonth
              ? formatPayslipPeriod(person.latestYear, person.latestMonth)
              : "No published slip yet"
          }
        />
        <StatCard
          label="Average net"
          value={person.averageNet !== null ? formatIls(person.averageNet) : "—"}
          hint={person.averageNet !== null ? "Last 12 months" : "Needs 3 months"}
        />
        <StatCard
          label="Vacation remaining"
          value={
            person.vacationAvailable !== null
              ? formatDays(person.vacationAvailable)
              : "—"
          }
        />
        <StatCard
          label="Sick remaining"
          value={
            person.sickAvailable !== null ? formatDays(person.sickAvailable) : "—"
          }
          hint={
            person.pendingRequests > 0
              ? `${person.pendingRequests} pending request${person.pendingRequests === 1 ? "" : "s"}`
              : undefined
          }
        />
      </div>

      {pendingApprovals.length > 0 && (
        <div className="mt-8 space-y-3 rounded-2xl border border-amber-200/80 bg-amber-50/40 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>⏳ Pending Time-Off Requests</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                {pendingApprovals.length} waiting for decision
              </span>
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            You can approve or reject {person.fullName.split(" ")[0]}&apos;s time-off requests directly from here.
          </p>
          <div className="space-y-3 pt-1">
            {pendingApprovals.map((req) => (
              <ApprovalCard key={req.id} request={req} />
            ))}
          </div>
        </div>
      )}

      <section className="mt-12 border-t border-slate-200 pt-8">
        <h2 className="text-sm font-medium text-slate-900">Remove from team</h2>
        <p className="mt-1 mb-3 max-w-xl text-xs text-slate-500">
          They stay at this business. Time-off requests stop coming to you until
          they are assigned a new line manager.
        </p>
        <RemoveFromTeamButton
          employeeId={person.id}
          fullName={person.fullName}
          redirectTo="/manager/team"
        />
      </section>
    </>
  );
}
