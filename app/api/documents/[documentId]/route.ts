import { NextResponse } from "next/server";

import { getDocumentDownloadUrl } from "@/lib/actions/documents";

/**
 * Same-origin hop so "Open" is a normal link, not a popup after an async
 * action. The signed URL lives only in this redirect, never in the page HTML.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  const result = await getDocumentDownloadUrl(documentId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.redirect(result.data, 307);
}
