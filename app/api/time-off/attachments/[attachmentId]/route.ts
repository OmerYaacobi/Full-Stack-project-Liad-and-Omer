import { NextResponse } from "next/server";

import { getTimeOffAttachmentUrl } from "@/lib/actions/time-off";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ attachmentId: string }> },
) {
  const { attachmentId } = await params;
  const result = await getTimeOffAttachmentUrl(attachmentId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.redirect(result.data, 307);
}
