"use server";

import { createHash } from "crypto";

import { revalidatePath } from "next/cache";

import { getMyEmployeeId } from "@/lib/actions/employees";
import { fail, fromZod, ok, type ActionResult } from "@/lib/actions/result";
import { createClient } from "@/lib/supabase/server";
import { MAX_PAYSLIP_BYTES, uploadPayslipSchema } from "@/lib/validations/payslips";

const BUCKET = "payslips";

export type StoredPayslip = {
  id: string;
  year: number;
  month: number;
  grossPay: number;
  netPay: number;
  totalDeductions: number;
  status: string;
  fileSize: number | null;
  createdAt: string;
  employeeName?: string | null;
  visibleToManagers: boolean;
};

export async function uploadPayslip(
  _previous: ActionResult<void> | null,
  formData: FormData,
): Promise<ActionResult<void>> {
  const parsed = uploadPayslipSchema.safeParse({
    companyId: formData.get("companyId"),
    employeeId: formData.get("employeeId"),
    shareWithManagers: formData.get("shareWithManagers") ?? "",
    year: formData.get("year"),
    month: formData.get("month"),
    grossPay: formData.get("grossPay") ?? "",
    netPay: formData.get("netPay") ?? "",
    totalDeductions: formData.get("totalDeductions") ?? "",
  });
  if (!parsed.success) return fromZod(parsed.error);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return fail("VALIDATION", "Choose a pay slip PDF.", {
      file: ["Choose a pay slip PDF."],
    });
  }

  const fileError = await checkPdf(file);
  if (fileError) return fail("VALIDATION", fileError, { file: [fileError] });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Your session has expired. Sign in again.");

  const {
    companyId,
    employeeId,
    shareWithManagers,
    year,
    month,
    grossPay,
    netPay,
    totalDeductions,
  } = parsed.data;

  const periodId = await ensurePeriod(supabase, companyId, year, month);
  if (!periodId) {
    return fail("INTERNAL", "Could not open that payroll month. Try again.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const path = `${companyId}/${employeeId}/${year}-${String(month).padStart(2, "0")}/${crypto.randomUUID()}.pdf`;

  const upload = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (upload.error) {
    return fail("INTERNAL", storageMessage(upload.error.message));
  }

  const { data: existing } = await supabase
    .from("payslips")
    .select("id, file_path")
    .eq("period_id", periodId)
    .eq("employee_id", employeeId)
    .maybeSingle();

  const row = {
    company_id: companyId,
    period_id: periodId,
    employee_id: employeeId,
    gross_pay: grossPay,
    net_pay: netPay,
    total_deductions: totalDeductions,
    file_path: path,
    file_size: file.size,
    file_checksum: checksum,
    status: "assigned",
    uploaded_by: user.id,
    visible_to_managers: shareWithManagers,
  };

  const write = existing
    ? await supabase.from("payslips").update(row).eq("id", existing.id)
    : await supabase.from("payslips").insert(row);

  if (write.error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return fail("INTERNAL", "The file uploaded but could not be recorded. Try again.");
  }

  if (existing?.file_path && existing.file_path !== path) {
    await supabase.storage.from(BUCKET).remove([existing.file_path]);
  }

  // Employees may only read status = published. The RPC flips the period and
  // every assigned slip in it, which is the contract the empty states describe.
  const { error: publishError } = await supabase.rpc("publish_payroll_period", {
    p_period_id: periodId,
  });
  if (publishError) {
    return fail(
      "INTERNAL",
      "The pay slip was saved but not published. Open it from this page and try again.",
    );
  }

  revalidateEmployeePayslips(companyId, employeeId);
  revalidatePath("/manager/shared");
  return ok(undefined);
}

export async function listEmployeePayslips(
  companyId: string,
  employeeId: string,
): Promise<StoredPayslip[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payslips")
    .select(
      "id, gross_pay, net_pay, total_deductions, status, file_size, created_at, visible_to_managers, payroll_periods(year, month)",
    )
    .eq("company_id", companyId)
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []).flatMap((row) => toStored(row) ?? []);
}

export async function listMyPayslips(
  membershipId: string,
  companyId: string,
): Promise<StoredPayslip[]> {
  const employeeId = await getMyEmployeeId(membershipId);
  if (!employeeId) return [];
  return listEmployeePayslips(companyId, employeeId);
}

export async function listPayslipsSharedWithManagers(
  companyId: string,
): Promise<StoredPayslip[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payslips")
    .select(
      "id, gross_pay, net_pay, total_deductions, status, file_size, created_at, visible_to_managers, payroll_periods(year, month), employees(full_name)",
    )
    .eq("company_id", companyId)
    .eq("visible_to_managers", true)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []).flatMap((row) => toStored(row) ?? []);
}

export async function setPayslipManagerShare(
  payslipId: string,
  visible: boolean,
): Promise<ActionResult<void>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payslips")
    .update({ visible_to_managers: visible })
    .eq("id", payslipId)
    .select("company_id, employee_id")
    .maybeSingle();

  if (error || !data) {
    return fail("FORBIDDEN", "Could not change who can open this pay slip.");
  }

  revalidatePath("/manager/shared");
  if (data.employee_id) {
    revalidatePath(
      `/bookkeeper/businesses/${data.company_id}/employees/${data.employee_id}`,
    );
  }
  return ok(undefined);
}

export async function getPayslipOpenUrl(
  payslipId: string,
): Promise<ActionResult<string>> {
  const supabase = await createClient();

  const { data: payslip, error } = await supabase
    .from("payslips")
    .select("file_path")
    .eq("id", payslipId)
    .maybeSingle();

  if (error || !payslip?.file_path) {
    return fail("NOT_FOUND", "That pay slip is no longer available.");
  }

  const { data, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(payslip.file_path, 120);

  if (signError || !data) {
    return fail("INTERNAL", "Could not open that pay slip. Try again.");
  }

  return ok(data.signedUrl);
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function ensurePeriod(
  supabase: SupabaseClient,
  companyId: string,
  year: number,
  month: number,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("payroll_periods")
    .select("id")
    .eq("company_id", companyId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from("payroll_periods")
    .insert({ company_id: companyId, year, month, status: "draft" })
    .select("id")
    .single();

  if (created?.id) return created.id;
  if (error?.code !== "23505") return null;

  const { data: raced } = await supabase
    .from("payroll_periods")
    .select("id")
    .eq("company_id", companyId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  return raced?.id ?? null;
}

function toStored(row: {
  id: string;
  gross_pay: number | string;
  net_pay: number | string;
  total_deductions: number | string;
  status: string;
  file_size: number | null;
  created_at: string;
  visible_to_managers?: boolean;
  payroll_periods:
    | { year: number; month: number }
    | { year: number; month: number }[]
    | null;
  employees?: { full_name: string } | { full_name: string }[] | null;
}): StoredPayslip | null {
  const period = Array.isArray(row.payroll_periods)
    ? row.payroll_periods[0]
    : row.payroll_periods;
  if (!period) return null;

  return {
    id: row.id,
    year: period.year,
    month: period.month,
    grossPay: Number(row.gross_pay),
    netPay: Number(row.net_pay),
    totalDeductions: Number(row.total_deductions),
    status: row.status,
    fileSize: row.file_size,
    createdAt: row.created_at,
    visibleToManagers: Boolean(row.visible_to_managers),
    employeeName: Array.isArray(row.employees)
      ? row.employees[0]?.full_name
      : row.employees?.full_name,
  };
}

function revalidateEmployeePayslips(companyId: string, employeeId: string) {
  revalidatePath("/employee");
  revalidatePath("/employee/payslips");
  revalidatePath(`/bookkeeper/businesses/${companyId}`);
  revalidatePath(`/bookkeeper/businesses/${companyId}/employees/${employeeId}`);
}

async function checkPdf(file: File): Promise<string | null> {
  if (file.size > MAX_PAYSLIP_BYTES) return "That file is larger than 10 MB.";
  if (file.type && file.type !== "application/pdf") {
    return "Pay slips must be a PDF.";
  }

  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const isPdf =
    head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46;
  if (!isPdf) return "That file is not a PDF.";
  return null;
}

function storageMessage(message: string): string {
  if (/row-level security|not authorized|violates/i.test(message)) {
    return "You do not have permission to upload a pay slip for this employee.";
  }
  return "The upload failed. Try again.";
}
