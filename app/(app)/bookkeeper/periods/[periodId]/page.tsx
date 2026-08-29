import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PeriodStatusBadge } from "@/components/periods/period-status-badge";
import { PublishPeriodButton } from "@/components/periods/publish-period-button";
import { PayslipOpenLink } from "@/components/payslips/payslip-open-link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getPayrollPeriod } from "@/lib/actions/periods";
import { formatIls, formatPayslipPeriod } from "@/lib/format";

export const metadata: Metadata = {
  title: "Payroll period",
};

export default async function PayrollPeriodPage({
  params,
}: {
  params: Promise<{ periodId: string }>;
}) {
  const { periodId } = await params;
  const period = await getPayrollPeriod(periodId);
  if (!period) notFound();

  const waiting = period.assignedCount - period.publishedCount;
  const missing = period.employees.filter((row) => row.slipStatus === null);
  const title = formatPayslipPeriod(period.year, period.month);

  return (
    <>
      <nav className="mb-4 text-sm text-slate-500">
        <Link href="/bookkeeper/periods" className="hover:text-slate-900">
          Payroll periods
        </Link>
        <span className="mx-2 text-slate-300">/</span>
        <span className="text-slate-700">{period.companyName}</span>
      </nav>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title={title}
          description={periodDescription(period.companyName, period.status, waiting)}
        />
        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <PeriodStatusBadge status={period.status} />
          <PublishPeriodButton
            periodId={period.id}
            year={period.year}
            month={period.month}
            status={period.status}
            assignedWaiting={waiting}
            employeeCount={period.employeeCount}
            assignedCount={period.assignedCount}
          />
        </div>
      </div>

      {/* Progress Bar & Stat Cards */}
      {(() => {
        const progressPercent =
          period.employeeCount > 0
            ? Math.round((period.assignedCount / period.employeeCount) * 100)
            : 0;
        return (
          <div className="mb-6 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between gap-4 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Payslip Coverage Progress
                </span>
                <span className="text-sm font-extrabold text-indigo-600">
                  {progressPercent}% · {period.assignedCount} of {period.employeeCount} uploaded
                </span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    progressPercent === 100
                      ? "bg-emerald-500"
                      : "bg-indigo-600"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  📄 Slips Uploaded
                </p>
                <p className="mt-1.5 text-xl font-bold text-slate-900">
                  {period.assignedCount} <span className="text-sm font-normal text-slate-400">/ {period.employeeCount} staff</span>
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  👁️ Visible to Staff
                </p>
                <p className="mt-1.5 text-xl font-bold text-emerald-700">
                  {period.publishedCount} <span className="text-sm font-normal text-emerald-600/70">published</span>
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  ⏳ Waiting to Publish
                </p>
                <p className="mt-1.5 text-xl font-bold text-amber-700">
                  {waiting} <span className="text-sm font-normal text-amber-600/70">in draft</span>
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Upload more slips via{" "}
          <Link
            href={`/bookkeeper/businesses/${period.companyId}`}
            className="font-bold text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
          >
            {period.companyName}
          </Link>
        </p>
      </div>

      {period.employees.length === 0 ? (
        <EmptyState
          title="Nobody on the payroll"
          description="Invite people to this business first, then upload their pay slips."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Employee</th>
                <th className="px-4 py-2.5">ID</th>
                <th className="px-4 py-2.5">Net</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {period.employees.map((row) => (
                <tr key={row.employeeId}>
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    <Link
                      href={`/bookkeeper/businesses/${period.companyId}/employees/${row.employeeId}`}
                      className="hover:underline"
                    >
                      {row.fullName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {row.nationalId || row.employeeNumber}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-slate-700">
                    {row.netPay !== null ? formatIls(row.netPay) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {row.slipStatus === "published" ? (
                      <span className="text-emerald-700">Visible</span>
                    ) : row.slipStatus === "assigned" ? (
                      <span className="text-amber-800">Ready</span>
                    ) : (
                      <span className="text-slate-400">Missing</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {row.payslipId ? (
                      <PayslipOpenLink payslipId={row.payslipId} />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {missing.length > 0 ? (
        <p className="mt-4 text-xs text-slate-500">
          {missing.length} employee{missing.length === 1 ? "" : "s"} still missing a
          slip
          {missing.length <= 8
            ? `: ${missing.map((row) => row.fullName).join(", ")}`
            : ""}
          . You can still publish the ones that are ready.
        </p>
      ) : waiting === 0 && period.assignedCount > 0 ? (
        <p className="mt-4 text-xs text-slate-500">
          Everyone with a slip can already open it.
        </p>
      ) : null}
    </>
  );
}

function periodDescription(
  companyName: string,
  status: "draft" | "published" | "locked",
  waiting: number,
): string {
  if (status === "locked") {
    return `${companyName}. This month is locked and cannot take more pay slips.`;
  }
  if (status === "published" && waiting > 0) {
    return `${companyName}. Employees can already open published slips. Publish the rest to make them visible.`;
  }
  if (status === "published") {
    return `${companyName}. Employees can open the pay slips for this month.`;
  }
  return `${companyName}. Employees cannot open these pay slips until this month is published.`;
}
