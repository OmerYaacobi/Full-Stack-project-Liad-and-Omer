import type { Metadata } from "next";
import Link from "next/link";

import { DocumentFolders } from "@/components/documents/document-folders";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { listMyDocuments } from "@/lib/actions/documents";
import { getMyEmployee } from "@/lib/actions/employees";
import { companyHasForm101ForYear } from "@/lib/actions/form-101";
import { requireMembership } from "@/lib/auth/context";

export const metadata: Metadata = {
  title: "Documents",
};

export default async function EmployeeDocumentsPage() {
  const ctx = await requireMembership();
  const companyId = ctx.membership.company.id;
  const [{ personal }, employee] = await Promise.all([
    listMyDocuments(ctx.membership.id, companyId),
    getMyEmployee(ctx.membership.id, companyId),
  ]);
  const taxYear = new Date().getFullYear();
  const hasForm101 = employee
    ? await companyHasForm101ForYear(companyId, employee.id, taxYear)
    : false;

  return (
    <>
      <PageHeader
        title="Documents"
        description="Forms and letters filed for you, including a Form 101 you can upload yourself."
      />

      {employee ? (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-medium text-slate-900">Form 101</h2>
          <p className="mt-1 text-sm text-slate-600">
            {hasForm101
              ? `A Form 101 for ${taxYear} is already on file. You can file another if something changed.`
              : `Optional. Fill it on the Form 101 site, save the PDF, and upload it here. Skip if payroll already has it.`}
          </p>
          <Link
            href="/employee/documents/form-101"
            className="mt-3 inline-flex rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            {hasForm101 ? "File another Form 101" : "Fill and upload Form 101"}
          </Link>
        </div>
      ) : null}

      {personal.length === 0 ? (
        <EmptyState
          title="Nothing filed for you yet"
          description="When your bookkeeper uploads a Form 106, a contract, or a pension report for you, it appears here."
        />
      ) : (
        <DocumentFolders documents={personal} />
      )}
    </>
  );
}
