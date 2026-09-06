import type { StoredDocument } from "@/lib/actions/documents";

import { DocumentOpenButton } from "./document-open-button";
import { DocumentShareToggle } from "./document-share-toggle";

export function DocumentFolder({
  label,
  hint,
  documents,
  canShare = false,
  collapsible = false,
}: {
  label: string;
  hint: string;
  documents: StoredDocument[];
  canShare?: boolean;
  collapsible?: boolean;
}) {
  const header = (
    <>
      <div className="min-w-0 text-left">
        <h3 className="text-sm font-medium text-slate-900">{label}</h3>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
      <span className="flex shrink-0 items-center gap-2">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
          {documents.length}
        </span>
        {collapsible ? (
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-90"
          >
            <path
              fillRule="evenodd"
              d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
              clipRule="evenodd"
            />
          </svg>
        ) : null}
      </span>
    </>
  );

  const body =
    documents.length === 0 ? (
      <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-400">
        Nothing in this folder yet.
      </p>
    ) : (
      <ul className="divide-y divide-slate-100 border-t border-slate-100">
        {documents.map((document) => (
          <li
            key={document.id}
            className="flex items-center justify-between gap-3 px-4 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-slate-900">{document.title}</p>
              <p className="text-xs text-slate-500">
                {[
                  document.employeeName,
                  document.companyName,
                  document.taxYear ? String(document.taxYear) : null,
                  formatSize(document.fileSize),
                  new Date(document.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }),
                  document.visibleToManagers && !canShare
                    ? "Shared with managers"
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
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
    );

  if (!collapsible) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white">
        <header className="flex items-center justify-between gap-3 px-4 py-3">
          {header}
        </header>
        {body}
      </section>
    );
  }

  return (
    <details className="group rounded-xl border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        {header}
      </summary>
      {body}
    </details>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
