import type { Metadata } from "next";

import { DocumentFolders } from "@/components/documents/document-folders";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { listMyDocuments } from "@/lib/actions/documents";
import { requireMembership } from "@/lib/auth/context";

export const metadata: Metadata = {
  title: "Documents",
};

export default async function EmployeeDocumentsPage() {
  const ctx = await requireMembership();
  const { personal } = await listMyDocuments(
    ctx.membership.id,
    ctx.membership.company.id,
  );

  return (
    <>
      <PageHeader
        title="Documents"
        description="Forms and letters your bookkeeper has filed for you."
      />

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
