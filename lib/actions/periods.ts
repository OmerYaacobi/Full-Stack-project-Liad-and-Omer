"use server";

import { revalidatePath } from "next/cache";

import { fail, fromZod, ok, type ActionResult } from "@/lib/actions/result";
import { createClient } from "@/lib/supabase/server";
import {
  openPayrollPeriodSchema,
  publishPayrollPeriodSchema,
  type PeriodStatus,
} from "@/lib/validations/periods";

export type PeriodSummary = {
  id: string;
  companyId: string;
  companyName: string;
  year: number;
  month: number;
  status: PeriodStatus;
  publishedAt: string | null;
  employeeCount: number;
  assignedCount: number;
  publishedCount: number;
};

export type PeriodEmployeeRow = {
  employeeId: string;
  fullName: string;
  nationalId: string | null;
  employeeNumber: string;
  payslipId: string | null;
  netPay: number | null;
  grossPay: number | null;
  slipStatus: "assigned" | "published" | null;
};

export type PeriodDetail = {
  id: string;
  companyId: string;
  companyName: string;
  year: number;
  month: number;
  status: PeriodStatus;
  publishedAt: string | null;
  employeeCount: number;
  assignedCount: number;
  publishedCount: number;
  employees: PeriodEmployeeRow[];
};

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function ensurePayrollPeriod(
  supabase: SupabaseClient,
  companyId: string,
  year: number,
  month: number,
): Promise<{ id: string; status: PeriodStatus } | { error: string }> {
  const { data: existing } = await supabase
    .from("payroll_periods")
    .select("id, status")
    .eq("company_id", companyId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (existing?.id) {
    if (existing.status === "locked") {
      return { error: "That payroll month is locked and cannot take more pay slips." };
    }
    return { id: existing.id, status: existing.status as PeriodStatus };
  }

  const { data: created, error } = await supabase
    .from("payroll_periods")
    .insert({ company_id: companyId, year, month, status: "draft" })
    .select("id, status")
    .single();

  if (created?.id) {
    return { id: created.id, status: created.status as PeriodStatus };
  }
  if (error?.code !== "23505") {
    return { error: "Could not open that payroll month. Try again." };
  }

  const { data: raced } = await supabase
    .from("payroll_periods")
    .select("id, status")
    .eq("company_id", companyId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (!raced?.id) return { error: "Could not open that payroll month. Try again." };
  if (raced.status === "locked") {
    return { error: "That payroll month is locked and cannot take more pay slips." };
  }
  return { id: raced.id, status: raced.status as PeriodStatus };
}

export async function openPayrollPeriod(
  _previous: ActionResult<{ periodId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ periodId: string }>> {
  const parsed = openPayrollPeriodSchema.safeParse({
    companyId: formData.get("companyId"),
    year: formData.get("year"),
    month: formData.get("month"),
  });
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const period = await ensurePayrollPeriod(
    supabase,
    parsed.data.companyId,
    parsed.data.year,
    parsed.data.month,
  );
  if ("error" in period) return fail("INTERNAL", period.error);

  revalidatePeriodPaths(parsed.data.companyId, period.id);
  return ok({ periodId: period.id });
}

export async function publishPayrollPeriod(
  periodId: string,
): Promise<ActionResult<{ publishedCount: number }>> {
  const parsed = publishPayrollPeriodSchema.safeParse({ periodId });
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { data: period } = await supabase
    .from("payroll_periods")
    .select("id, company_id, status")
    .eq("id", parsed.data.periodId)
    .maybeSingle();

  if (!period) return fail("NOT_FOUND", "That payroll month is no longer available.");
  if (period.status === "locked") {
    return fail("CONFLICT", "That payroll month is locked.");
  }

  const { count } = await supabase
    .from("payslips")
    .select("id", { count: "exact", head: true })
    .eq("period_id", period.id)
    .eq("status", "assigned");

  const waiting = count ?? 0;
  if (waiting === 0 && period.status === "draft") {
    return fail("VALIDATION", "Upload at least one pay slip before publishing this month.");
  }
  if (waiting === 0) {
    return fail("VALIDATION", "Every pay slip in this month is already published.");
  }

  const { error } = await supabase.rpc("publish_payroll_period", {
    p_period_id: period.id,
  });
  if (error) {
    return fail("INTERNAL", "Could not publish that month. Try again.");
  }

  revalidatePeriodPaths(period.company_id, period.id);
  revalidatePath("/employee");
  revalidatePath("/employee/payslips");
  revalidatePath("/manager/shared");
  return ok({ publishedCount: waiting });
}

export async function listPayrollPeriods(): Promise<PeriodSummary[]> {
  const supabase = await createClient();
  const { data: periods, error } = await supabase
    .from("payroll_periods")
    .select("id, company_id, year, month, status, published_at, companies(name)")
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (error || !periods?.length) return [];

  const companyIds = [...new Set(periods.map((row) => row.company_id))];
  const periodIds = periods.map((row) => row.id);

  const [{ data: employees }, { data: slips }] = await Promise.all([
    supabase
      .from("employees")
      .select("id, company_id, status")
      .in("company_id", companyIds)
      .in("status", ["active", "on_leave"]),
    supabase
      .from("payslips")
      .select("period_id, status, employee_id")
      .in("period_id", periodIds),
  ]);

  const employeeCountByCompany = new Map<string, number>();
  for (const row of employees ?? []) {
    employeeCountByCompany.set(
      row.company_id,
      (employeeCountByCompany.get(row.company_id) ?? 0) + 1,
    );
  }

  const slipStats = new Map<string, { assigned: number; published: number }>();
  for (const slip of slips ?? []) {
    const current = slipStats.get(slip.period_id) ?? { assigned: 0, published: 0 };
    if (slip.status === "published") current.published += 1;
    if (slip.status === "assigned" || slip.status === "published") current.assigned += 1;
    slipStats.set(slip.period_id, current);
  }

  return periods.map((row) => {
    const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
    const stats = slipStats.get(row.id) ?? { assigned: 0, published: 0 };
    return {
      id: row.id,
      companyId: row.company_id,
      companyName: company?.name ?? "Business",
      year: row.year,
      month: row.month,
      status: row.status as PeriodStatus,
      publishedAt: row.published_at,
      employeeCount: employeeCountByCompany.get(row.company_id) ?? 0,
      assignedCount: stats.assigned,
      publishedCount: stats.published,
    };
  });
}

function periodNeedsPublish(period: PeriodSummary): boolean {
  return period.status !== "locked" && period.assignedCount > period.publishedCount;
}

export async function countUnpublishedPeriods(): Promise<number> {
  const periods = await listPayrollPeriods();
  return periods.filter(periodNeedsPublish).length;
}

export async function getPayrollPeriod(
  periodId: string,
): Promise<PeriodDetail | null> {
  const supabase = await createClient();
  const { data: period, error } = await supabase
    .from("payroll_periods")
    .select("id, company_id, year, month, status, published_at, companies(name)")
    .eq("id", periodId)
    .maybeSingle();

  if (error || !period) return null;

  const [{ data: employees }, { data: slips }] = await Promise.all([
    supabase
      .from("employees")
      .select("id, full_name, national_id, employee_number, status")
      .eq("company_id", period.company_id)
      .in("status", ["active", "on_leave"])
      .order("full_name", { ascending: true }),
    supabase
      .from("payslips")
      .select("id, employee_id, net_pay, gross_pay, status")
      .eq("period_id", period.id),
  ]);

  const slipByEmployee = new Map(
    (slips ?? [])
      .filter((row) => row.employee_id)
      .map((row) => [row.employee_id as string, row]),
  );

  const roster: PeriodEmployeeRow[] = (employees ?? []).map((employee) => {
    const slip = slipByEmployee.get(employee.id);
    return {
      employeeId: employee.id,
      fullName: employee.full_name,
      nationalId: employee.national_id,
      employeeNumber: employee.employee_number,
      payslipId: slip?.id ?? null,
      netPay: slip ? Number(slip.net_pay) : null,
      grossPay: slip ? Number(slip.gross_pay) : null,
      slipStatus:
        slip?.status === "published" || slip?.status === "assigned"
          ? slip.status
          : null,
    };
  });

  const assignedCount = roster.filter((row) => row.slipStatus !== null).length;
  const publishedCount = roster.filter((row) => row.slipStatus === "published").length;
  const company = Array.isArray(period.companies)
    ? period.companies[0]
    : period.companies;

  return {
    id: period.id,
    companyId: period.company_id,
    companyName: company?.name ?? "Business",
    year: period.year,
    month: period.month,
    status: period.status as PeriodStatus,
    publishedAt: period.published_at,
    employeeCount: roster.length,
    assignedCount,
    publishedCount,
    employees: roster,
  };
}

function revalidatePeriodPaths(companyId: string, periodId: string) {
  revalidatePath("/bookkeeper");
  revalidatePath("/bookkeeper/periods");
  revalidatePath(`/bookkeeper/periods/${periodId}`);
  revalidatePath(`/bookkeeper/businesses/${companyId}`);
}
