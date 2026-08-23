"use server";

import { parseDigitalPayslipPdf, type ParsedPayslipResponse } from "@/lib/payslip/parser";

export async function parsePayslipAction(formData: FormData): Promise<ParsedPayslipResponse> {
  try {
    const file = formData.get("file") as File | null;
    if (!file) {
      return { success: false, error: "No PDF file provided." };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return await parseDigitalPayslipPdf(buffer, file.name);
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to process uploaded payslip.",
    };
  }
}
