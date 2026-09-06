import type { Metadata } from "next";
import Link from "next/link";

import { DocumentFolders } from "@/components/documents/document-folders";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { listFirmDocuments } from "@/lib/actions/documents";

export const metadata: Metadata = {
  title: "Documents",
};

export default async function BookkeeperDocumentsPage() {
  const documents = await listFirmDocuments();

  return (
    <>
      <PageHeader
        title="Documents"
        description="Form 106, Form 101, contracts, and pension files across every business you manage. Pay slips stay on Payroll periods."
      />

      {documents.length === 0 ? (
        <EmptyState
          title="No files yet"
          description="Upload a Form 106, Form 101, contract, or pension report on a business or a person’s page. It will show up here."
          action={
            <Link
              href="/bookkeeper/businesses"
              className="inline-flex rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Open businesses
            </Link>
          }
        />
      ) : (
        <DocumentFolders
          documents={documents}
          canShare
          collapsible
          showEmpty
        />
      )}
    </>
  );
}
