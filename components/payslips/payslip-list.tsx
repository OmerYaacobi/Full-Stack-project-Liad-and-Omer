import { PayslipOpenLink } from "@/components/payslips/payslip-open-link";
import { PayslipShareToggle } from "@/components/payslips/payslip-share-toggle";
import { EmptyState } from "@/components/shared/empty-state";
import type { StoredPayslip } from "@/lib/actions/payslips";
import { formatIls, formatPayslipPeriod } from "@/lib/format";

export function PayslipList({
  payslips,
  emptyTitle,
  emptyDescription,
  canShare = false,
}: {
  payslips: StoredPayslip[];
  emptyTitle: string;
  emptyDescription: string;
  canShare?: boolean;
}) {
  if (payslips.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const byYear = new Map<number, StoredPayslip[]>();
  for (const payslip of payslips) {
    const group = byYear.get(payslip.year) ?? [];
    group.push(payslip);
    byYear.set(payslip.year, group);
  }

  return (
    <div className="space-y-6">
      {[...byYear.entries()].map(([year, rows]) => (
        <section key={year} className="rounded-xl border border-slate-200 bg-white">
          <header className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-medium text-slate-900">{year}</h3>
          </header>
          <ul className="divide-y divide-slate-100">
            {rows
              .slice()
              .sort((a, b) => b.month - a.month)
              .map((payslip) => (
                <li
                  key={payslip.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {payslip.employeeName
                        ? `${payslip.employeeName} · ${formatPayslipPeriod(payslip.year, payslip.month)}`
                        : formatPayslipPeriod(payslip.year, payslip.month)}
                    </p>
                    <p className="text-xs text-slate-500">
                      Net {formatIls(payslip.netPay)}
                      {payslip.grossPay > 0
                        ? ` · Gross ${formatIls(payslip.grossPay)}`
                        : ""}
                      {payslip.totalDeductions > 0
                        ? ` · Deductions ${formatIls(payslip.totalDeductions)}`
                        : ""}
                      {canShare
                        ? payslip.status === "published"
                          ? " · Visible"
                          : payslip.status === "assigned"
                            ? " · Ready to publish"
                            : ""
                        : ""}
                      {payslip.visibleToManagers && !canShare
                        ? " · Shared with managers"
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {canShare && (
                      <PayslipShareToggle
                        payslipId={payslip.id}
                        shared={payslip.visibleToManagers}
                      />
                    )}
                    <PayslipOpenLink payslipId={payslip.id} />
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
