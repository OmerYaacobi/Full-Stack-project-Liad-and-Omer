import type { Metadata } from "next";

import { DocumentFolders } from "@/components/documents/document-folders";
import { PayslipList } from "@/components/payslips/payslip-list";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { listDocumentsSharedWithManagers } from "@/lib/actions/documents";
import { listPayslipsSharedWithManagers } from "@/lib/actions/payslips";
import { requireMembership } from "@/lib/auth/context";

export const metadata: Metadata = {
  title: "Shared files",
};

export default async function ManagerSharedPage() {
  const ctx = await requireMembership();
  const companyId = ctx.membership.company.id;

  const [documents, payslips] = await Promise.all([
    listDocumentsSharedWithManagers(companyId),
    listPayslipsSharedWithManagers(companyId),
  ]);

  return (
    <>
      <PageHeader
        title="Shared files"
        description="Pay slips and documents your bookkeeper sent to managers. These are not your own payroll files."
      />

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-slate-900">Pay slips</h2>
        <PayslipList
          payslips={payslips}
          emptyTitle="No pay slips shared with you"
          emptyDescription="When a bookkeeper ticks “Managers can open this” on a pay slip, it appears here."
        />
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-sm font-medium text-slate-900">Documents</h2>
        {documents.length === 0 ? (
          <EmptyState
            title="No documents shared with you"
            description="Shared forms and contracts for people on your team appear here."
          />
        ) : (
          <DocumentFolders documents={documents} />
        )}
      </section>
    </>
  );
}
