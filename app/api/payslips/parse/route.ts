import { NextRequest, NextResponse } from "next/server";
import { parseDigitalPayslipPdf } from "@/lib/payslip/parser";
import { createClient } from "@/lib/supabase/server";

const MAX_PARSE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  try {
    // Authenticate the caller
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "You must be signed in to parse a pay slip." },
        { status: 401 },
      );
    }

    // Enforce a file size limit before reading the body into memory
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_PARSE_BYTES) {
      return NextResponse.json(
        { success: false, error: "File too large. The maximum size is 10 MB." },
        { status: 413 },
      );
    }

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

      if (file.size > MAX_PARSE_BYTES) {
        return NextResponse.json(
          { success: false, error: "File too large. The maximum size is 10 MB." },
          { status: 413 },
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else if (contentType.includes("application/pdf")) {
      const arrayBuffer = await request.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);

      if (buffer.length > MAX_PARSE_BYTES) {
        return NextResponse.json(
          { success: false, error: "File too large. The maximum size is 10 MB." },
          { status: 413 },
        );
      }
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
