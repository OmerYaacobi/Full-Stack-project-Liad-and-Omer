import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DocumentFolder } from "@/components/documents/document-folder";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { PayslipList } from "@/components/payslips/payslip-list";
import { PayslipUploadForm } from "@/components/payslips/payslip-upload-form";
import { PageHeader } from "@/components/shared/page-header";
import { listCompanyDocuments } from "@/lib/actions/documents";
import { getCompanyEmployee } from "@/lib/actions/employees";
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
  const [{ data: company }, employee] = await Promise.all([
    supabase.from("companies").select("id, name").eq("id", companyId).maybeSingle(),
    getCompanyEmployee(companyId, employeeId),
  ]);

  if (!company || !employee) notFound();

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
          `#${employee.employeeNumber}`,
          employee.jobTitle,
          employee.department,
          `${payslips.length} ${payslips.length === 1 ? "pay slip" : "pay slips"}`,
          `${documents.length} ${documents.length === 1 ? "file" : "files"}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      <PayslipUploadForm companyId={companyId} employee={employee} />

      <div className="mt-8 space-y-4">
        <h2 className="text-sm font-medium text-slate-900">Pay slips</h2>
        <PayslipList
          payslips={payslips}
          emptyTitle="No pay slips yet"
          emptyDescription="Upload a PDF for a payroll month. It is published straight away so they can open it."
          canShare
        />
      </div>

      <DocumentUploadForm companyId={companyId} lockedTo={employee} />

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
    </>
  );
}
