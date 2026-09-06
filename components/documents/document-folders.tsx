import type { StoredDocument } from "@/lib/actions/documents";
import { DOCUMENT_KINDS } from "@/lib/validations/documents";

import { DocumentFolder } from "./document-folder";

/** Only folders that have at least one file, so a single form is not four empty drawers. */
export function DocumentFolders({
  documents,
  canShare = false,
  collapsible = false,
  showEmpty = false,
}: {
  documents: StoredDocument[];
  canShare?: boolean;
  collapsible?: boolean;
  showEmpty?: boolean;
}) {
  return (
    <div className="space-y-3">
      {DOCUMENT_KINDS.map((kind) => ({
        ...kind,
        documents: documents.filter((doc) => doc.kind === kind.value),
      }))
        .filter((folder) => showEmpty || folder.documents.length > 0)
        .map((folder) => (
          <DocumentFolder
            key={folder.value}
            label={folder.label}
            hint={folder.hint}
            documents={folder.documents}
            canShare={canShare}
            collapsible={collapsible}
          />
        ))}
    </div>
  );
}
