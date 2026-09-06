"use client";

import { setDocumentManagerShare } from "@/lib/actions/documents";
import { ManagerShareToggle } from "@/components/shared/manager-share-toggle";

export function DocumentShareToggle({
  documentId,
  shared,
}: {
  documentId: string;
  shared: boolean;
}) {
  return (
    <ManagerShareToggle
      shared={shared}
      onToggle={(next) => setDocumentManagerShare(documentId, next)}
    />
  );
}
