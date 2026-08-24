import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AssignManagerForm } from "@/components/employees/assign-manager-form";
import { TerminateEmployeeButton } from "@/components/employees/terminate-employee-button";
import { DocumentFolder } from "@/components/documents/document-folder";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { PayslipList } from "@/components/payslips/payslip-list";
import { PayslipUploadForm } from "@/components/payslips/payslip-upload-form";
import { PageHeader } from "@/components/shared/page-header";
import { listCompanyDocuments } from "@/lib/actions/documents";
import {
  ensureEmployeeEntitlements,
  getCompanyEmployee,
  listCompanyManagers,
} from "@/lib/actions/employees";
import { listEmployeePayslips } from "@/lib/actions/payslips";
import { createClient } from "@/lib/supabase/server";
import { DOCUMENT_KINDS } from "@/lib/validations/documents";

export const metadata: Metadata = {
  title: "Employee documents",
};

export default async function EmployeeDocumentsPage({
  params,
}: {
  params: Promise<{ companyId: string; employeeId: string }>;
}) {
  const { companyId, employeeId } = await params;

  const supabase = await createClient();
  const [{ data: company }, employee, managers] = await Promise.all([
    supabase.from("companies").select("id, name").eq("id", companyId).maybeSingle(),
    getCompanyEmployee(companyId, employeeId),
    listCompanyManagers(companyId),
  ]);

  if (!company || !employee) notFound();

  await ensureEmployeeEntitlements(companyId, employeeId, employee.startDate);

  const [documents, payslips] = await Promise.all([
    listCompanyDocuments(companyId, employeeId),
    listEmployeePayslips(companyId, employeeId),
  ]);

  return (
    <>
      <nav className="mb-4 text-sm text-slate-500">
        <Link href="/bookkeeper/businesses" className="hover:text-slate-900">
          Businesses
        </Link>
        <span className="mx-2 text-slate-300">/</span>
        <Link
          href={`/bookkeeper/businesses/${companyId}`}
          className="hover:text-slate-900"
        >
          {company.name}
        </Link>
        <span className="mx-2 text-slate-300">/</span>
        <span className="text-slate-700">{employee.fullName}</span>
      </nav>

      <PageHeader
        title={employee.fullName}
        description={[
          employee.status === "terminated" ? "Removed from payroll" : null,
          employee.nationalId ? `ID: ${employee.nationalId}` : `#${employee.employeeNumber}`,
          employee.jobTitle,
          employee.department,
          `${payslips.length} ${payslips.length === 1 ? "pay slip" : "pay slips"}`,
          `${documents.length} ${documents.length === 1 ? "file" : "files"}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      {employee.status === "terminated" ? (
        <p className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          This person is off the payroll. They cannot sign in. Files below stay
          for history.
        </p>
      ) : null}

      {employee.status !== "terminated" ? (
        <AssignManagerForm
          companyId={companyId}
          employee={employee}
          managers={managers}
        />
      ) : null}

      {employee.status !== "terminated" ? (
        <div className="mt-8">
          <PayslipUploadForm companyId={companyId} employee={employee} />
        </div>
      ) : null}

      <div className="mt-8 space-y-4">
        <h2 className="text-sm font-medium text-slate-900">Pay slips</h2>
        <PayslipList
          payslips={payslips}
          emptyTitle="No pay slips yet"
          emptyDescription="Upload a PDF for a payroll month. It stays in draft until you publish that month from Payroll periods."
          canShare
        />
      </div>

      {employee.status !== "terminated" ? (
        <DocumentUploadForm companyId={companyId} lockedTo={employee} />
      ) : null}

      <div className="mt-8 space-y-4">
        <h2 className="text-sm font-medium text-slate-900">Folders</h2>
        <p className="-mt-2 text-xs text-slate-500">
          Only {employee.fullName.split(" ")[0]}, their manager, and you can open
          these.
        </p>
        {DOCUMENT_KINDS.map((kind) => (
          <DocumentFolder
            key={kind.value}
            label={kind.label}
            hint={kind.hint}
            documents={documents.filter((doc) => doc.kind === kind.value)}
            canShare
          />
        ))}
      </div>

      {employee.status !== "terminated" ? (
        <section className="mt-12 border-t border-slate-200 pt-8">
          <h2 className="text-sm font-medium text-slate-900">
            Remove from payroll
          </h2>
          <p className="mt-1 mb-3 max-w-xl text-xs text-slate-500">
            They lose access immediately. Pay slips and files stay on this
            business for history.
          </p>
          <TerminateEmployeeButton
            employeeId={employee.id}
            fullName={employee.fullName}
            role={employee.role}
            redirectTo={`/bookkeeper/businesses/${companyId}`}
          />
        </section>
      ) : null}
    </>
  );
}
