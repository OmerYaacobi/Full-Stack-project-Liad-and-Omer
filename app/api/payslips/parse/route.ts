import { NextRequest, NextResponse } from "next/server";
import { parseDigitalPayslipPdf } from "@/lib/payslip/parser";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let buffer: Buffer;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json(
          { success: false, error: "Missing PDF file. Please upload a file under the 'file' field." },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else if (contentType.includes("application/pdf")) {
      const arrayBuffer = await request.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      return NextResponse.json(
        { success: false, error: "Unsupported Content-Type. Please use multipart/form-data or application/pdf." },
        { status: 415 }
      );
    }

    // Parse the PDF buffer
    const result = await parseDigitalPayslipPdf(buffer);

    if (!result.success && result.error === "SCANNED_PDF_NOT_SUPPORTED") {
      return NextResponse.json(result, { status: 422 });
    }

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

