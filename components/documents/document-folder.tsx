import type { StoredDocument } from "@/lib/actions/documents";

import { DocumentOpenButton } from "./document-open-button";
import { DocumentShareToggle } from "./document-share-toggle";

export function DocumentFolder({
  label,
  hint,
  documents,
  canShare = false,
}: {
  label: string;
  hint: string;
  documents: StoredDocument[];
  canShare?: boolean;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="flex items-baseline justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-medium text-slate-900">{label}</h3>
          <p className="text-xs text-slate-500">{hint}</p>
        </div>
        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
          {documents.length}
        </span>
      </header>

      {documents.length === 0 ? (
        <p className="px-4 py-3 text-sm text-slate-400">Empty</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {documents.map((document) => (
            <li
              key={document.id}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-900">{document.title}</p>
                <p className="text-xs text-slate-500">
                  {document.employeeName ? `${document.employeeName} · ` : ""}
                  {document.taxYear ? `${document.taxYear} · ` : ""}
                  {formatSize(document.fileSize)} ·{" "}
                  {new Date(document.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  {document.visibleToManagers && !canShare
                    ? " · Shared with managers"
                    : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {canShare && (
                  <DocumentShareToggle
                    documentId={document.id}
                    shared={document.visibleToManagers}
                  />
                )}
                <DocumentOpenButton documentId={document.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
