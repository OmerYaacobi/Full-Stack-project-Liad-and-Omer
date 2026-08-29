"use server";

import { createHash } from "crypto";

import { revalidatePath } from "next/cache";

import { applyPayslipLeaveBalances, getMyEmployeeId } from "@/lib/actions/employees";
import { ensurePayrollPeriod } from "@/lib/actions/periods";
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
  _previous: ActionResult<{ published: boolean; periodId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ published: boolean; periodId: string }>> {
  const parsed = uploadPayslipSchema.safeParse({
    companyId: formData.get("companyId"),
    employeeId: formData.get("employeeId"),
    shareWithManagers: formData.get("shareWithManagers") ?? "",
    year: formData.get("year"),
    month: formData.get("month"),
    grossPay: formData.get("grossPay") ?? "",
    netPay: formData.get("netPay") ?? "",
    totalDeductions: formData.get("totalDeductions") ?? "",
    vacationDays: formData.get("vacationDays") ?? "",
    sickDays: formData.get("sickDays") ?? "",
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
    vacationDays,
    sickDays,
  } = parsed.data;

  const period = await ensurePayrollPeriod(supabase, companyId, year, month);
  if ("error" in period) {
    return fail("INTERNAL", period.error);
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
    .eq("period_id", period.id)
    .eq("employee_id", employeeId)
    .maybeSingle();

  const alreadyLive = period.status === "published";
  const row = {
    company_id: companyId,
    period_id: period.id,
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

  if (alreadyLive) {
    const { error: publishError } = await supabase.rpc("publish_payroll_period", {
      p_period_id: period.id,
    });
    if (publishError) {
      return fail(
        "INTERNAL",
        "The pay slip was saved but not published. Open Payroll periods and publish the month.",
      );
    }
  }

  revalidateEmployeePayslips(companyId, employeeId);
  revalidatePath("/manager/shared");
  revalidatePath("/employee/time-off");
  revalidatePath("/employee");
  revalidatePath("/bookkeeper");
  revalidatePath("/bookkeeper/periods");
  revalidatePath(`/bookkeeper/periods/${period.id}`);

  await applyPayslipLeaveBalances({
    companyId,
    employeeId,
    year,
    month,
    vacationDays,
    sickDays,
    actorId: user.id,
  });

  return ok({ published: alreadyLive, periodId: period.id });
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

export async function listPublishedPayslipsForEmployees(
  companyId: string,
  employeeIds: string[],
): Promise<Map<string, StoredPayslip[]>> {
  const grouped = new Map<string, StoredPayslip[]>();
  if (employeeIds.length === 0) return grouped;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payslips")
    .select(
      "id, employee_id, gross_pay, net_pay, total_deductions, status, file_size, created_at, visible_to_managers, payroll_periods(year, month)",
    )
    .eq("company_id", companyId)
    .in("employee_id", employeeIds)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) return grouped;

  for (const row of data ?? []) {
    const stored = toStored(row);
    if (!stored || !row.employee_id) continue;
    const list = grouped.get(row.employee_id) ?? [];
    list.push(stored);
    grouped.set(row.employee_id, list);
  }
  return grouped;
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

export async function listCompanyExistingPayslipKeys(
  companyId: string,
): Promise<{ employeeId: string; year: number; month: number }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payslips")
    .select("employee_id, payroll_periods(year, month)")
    .eq("company_id", companyId);

  if (error || !data) return [];
  const results: { employeeId: string; year: number; month: number }[] = [];
  for (const row of data as any[]) {
    const period = Array.isArray(row.payroll_periods) ? row.payroll_periods[0] : row.payroll_periods;
    if (row.employee_id && period?.year && period?.month) {
      results.push({
        employeeId: row.employee_id,
        year: Number(period.year),
        month: Number(period.month),
      });
    }
  }
  return results;
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
