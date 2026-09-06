import type { Metadata } from "next";
import Link from "next/link";

import { OpenPeriodForm } from "@/components/periods/open-period-form";
import { PeriodStatusBadge } from "@/components/periods/period-status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { listFirmBusinesses } from "@/lib/actions/businesses";
import { listPayrollPeriods } from "@/lib/actions/periods";
import { formatPayslipPeriod } from "@/lib/format";

export const metadata: Metadata = {
  title: "Payroll periods",
};

export default async function PayrollPeriodsPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const { companyId } = await searchParams;
  const [{ data: businesses }, periods] = await Promise.all([
    listFirmBusinesses(),
    listPayrollPeriods(),
  ]);

  const visible = companyId
    ? periods.filter((period) => period.companyId === companyId)
    : periods;

  return (
    <>
      <PageHeader
        title="Payroll periods"
        description="Open a month, upload pay slips, then publish so employees can open them. Draft months stay invisible until you publish."
      />

      <OpenPeriodForm
        businesses={businesses.map((row) => ({ id: row.id, name: row.name }))}
        defaultCompanyId={
          companyId && businesses.some((row) => row.id === companyId)
            ? companyId
            : undefined
        }
      />

      <div className="mt-8 space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium text-slate-900">Months</h2>
          {companyId ? (
            <Link
              href="/bookkeeper/periods"
              className="text-xs font-medium text-slate-500 hover:text-slate-900"
            >
              All businesses
            </Link>
          ) : null}
        </div>
        {visible.length === 0 ? (
          <EmptyState
            title={companyId ? "No payroll months for this business" : "No payroll months yet"}
            description="Open a month above, then upload pay slips from the business page. Publish the month when the roster looks right."
          />
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {visible.map((period) => {
              const waiting = period.assignedCount - period.publishedCount;
              return (
                <li key={period.id}>
                  <Link
                    href={`/bookkeeper/periods/${period.id}`}
                    className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {period.companyName}
                        <span className="ml-2 font-normal text-slate-500">
                          {formatPayslipPeriod(period.year, period.month)}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {period.assignedCount} of {period.employeeCount} employees have a slip
                        {waiting > 0 ? ` · ${waiting} waiting to publish` : ""}
                      </p>
                    </div>
                    <PeriodStatusBadge status={period.status} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
