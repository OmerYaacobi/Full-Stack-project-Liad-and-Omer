import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { InvitePeoplePanel } from "@/components/invites/invite-people-panel";
import { RemoveCompanyButton } from "@/components/businesses/remove-company-button";
import { SmartBusinessPayslipUpload } from "@/components/payslips/smart-business-payslip-upload";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { countDocumentsByEmployee } from "@/lib/actions/documents";
import { listCompanyEmployees, listCompanyManagers } from "@/lib/actions/employees";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Business documents",
};

export default async function BusinessPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const supabase = await createClient();

  // RLS already limits companies to those the caller's firm manages, so an id
  // belonging to someone else's client comes back empty rather than forbidden.
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, tax_id")
    .eq("id", companyId)
    .maybeSingle();

  if (!company) notFound();

  const [employees, managers, perEmployeeCounts] = await Promise.all([
    listCompanyEmployees(companyId),
    listCompanyManagers(companyId),
    countDocumentsByEmployee(companyId),
  ]);

  const activePeople = employees.filter((row) => row.status !== "terminated");

  return (
    <>
      <nav className="mb-4 text-sm text-slate-500">
        <Link href="/bookkeeper/businesses" className="hover:text-slate-900">
          Businesses
        </Link>
        <span className="mx-2 text-slate-300">/</span>
        <span className="text-slate-700">{company.name}</span>
      </nav>

      <PageHeader
        title={company.name}
        description={`Tax ID ${company.tax_id}`}
      />

      <p className="mb-6 -mt-2 text-sm text-slate-600">
        <Link
          href={`/bookkeeper/periods?companyId=${company.id}`}
          className="font-medium text-slate-900 underline underline-offset-2"
        >
          Payroll periods
        </Link>{" "}
        for this business — upload slips here, then publish the month so employees can open them.
      </p>

      <InvitePeoplePanel
        companyId={company.id}
        companyName={company.name}
        managers={managers.map((row) => ({ id: row.id, fullName: row.fullName }))}
      />

      {activePeople.length > 0 && (
        <div className="mt-8 space-y-6">
          <SmartBusinessPayslipUpload
            companyId={companyId}
            employees={activePeople}
          />
          <DocumentUploadForm
            companyId={companyId}
            employees={activePeople}
          />
        </div>
      )}

      <div className="mt-8 space-y-4">
        <h2 className="text-sm font-medium text-slate-900">People</h2>
        {employees.length === 0 ? (
          <EmptyState
            title="Nobody on the payroll yet"
            description="Create an invitation link above. When they open it and choose a password, they appear here."
          />
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {employees.map((employee) => (
              <li
                key={employee.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <Link
                  href={`/bookkeeper/businesses/${companyId}/employees/${employee.id}`}
                  className="min-w-0 flex-1 hover:underline"
                >
                  <p className="truncate text-sm font-medium text-slate-900">
                    {employee.fullName}
                    {employee.status === "terminated" ? (
                      <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                        Removed
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-slate-500">
                    {employee.role === "manager" ? "Manager" : "Employee"}
                    {" · "}ID: {employee.nationalId || employee.employeeNumber}
                    {employee.jobTitle ? ` · ${employee.jobTitle}` : ""}
                    {employee.managerName
                      ? ` · Reports to ${employee.managerName}`
                      : " · No line manager"}
                  </p>
                </Link>
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                  {perEmployeeCounts[employee.id] ?? 0}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <section className="mt-12 border-t border-slate-200 pt-8">
        <h2 className="text-sm font-medium text-slate-900">Remove this business</h2>
        <p className="mt-1 mb-3 max-w-xl text-xs text-slate-500">
          Deletes the business, its people, pay slips, and files. This cannot be
          undone.
        </p>
        <RemoveCompanyButton companyId={company.id} companyName={company.name} />
      </section>
    </>
  );
}
