import { NextResponse } from "next/server";

import { getPayslipOpenUrl } from "@/lib/actions/payslips";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ payslipId: string }> },
) {
  const { payslipId } = await params;
  const result = await getPayslipOpenUrl(payslipId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.redirect(result.data, 307);
}
