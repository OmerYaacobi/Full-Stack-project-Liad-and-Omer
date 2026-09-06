/**
 * A real link, not window.open after a server action. The click stays
 * synchronous so the browser is allowed to open the tab, and the API route
 * 307s to a signed URL that still has the file's PDF or JPEG Content-Type.
 */
export function DocumentOpenButton({ documentId }: { documentId: string }) {
  return (
    <a
      href={`/api/documents/${documentId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="shrink-0 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
    >
      Open
    </a>
  );
}
