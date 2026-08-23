"use server";

import { revalidatePath } from "next/cache";

import { fail, fromZod, ok, type ActionResult } from "@/lib/actions/result";
import { entitledDaysForYear } from "@/lib/domain/working-days";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const setEmployeeManagerSchema = z.object({
  companyId: z.string().uuid(),
  employeeId: z.string().uuid(),
  managerId: z
    .union([z.string().uuid(), z.literal("")])
    .transform((value) => (value === "" ? null : value)),
});

export type CompanyEmployee = {
  id: string;
  fullName: string;
  employeeNumber: string;
  nationalId: string | null;
  jobTitle: string | null;
  department: string | null;
  status: string;
  role: "employee" | "manager" | null;
  managerId: string | null;
  managerName: string | null;
  startDate: string;
};

/**
 * Everyone on a company's payroll. RLS narrows this to companies the caller's
 * firm manages, so no company filter beyond the id is needed here.
 */
export async function listCompanyEmployees(
  companyId: string,
): Promise<CompanyEmployee[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("employees")
    .select(
      "id, full_name, employee_number, national_id, job_title, department, status, manager_id, start_date, memberships(role)",
    )
    .eq("company_id", companyId)
    .order("full_name", { ascending: true });

  if (error) return [];

  const names = new Map(
    (data ?? []).map((row) => [row.id, row.full_name] as const),
  );

  return (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    employeeNumber: row.employee_number,
    nationalId: row.national_id || row.employee_number || null,
    jobTitle: row.job_title,
    department: row.department,
    status: row.status,
    role: membershipRole(row.memberships),
    managerId: row.manager_id,
    managerName: row.manager_id ? (names.get(row.manager_id) ?? null) : null,
    startDate: row.start_date,
  }));
}

export async function listCompanyManagers(
  companyId: string,
): Promise<CompanyEmployee[]> {
  const employees = await listCompanyEmployees(companyId);
  return employees.filter((row) => row.role === "manager");
}

/**
 * The signed-in user's own employee record, found through the membership that
 * links a login to a payroll row. Null for anyone with no HR record in the
 * company, which includes a firm bookkeeper looking at a client.
 */
export async function getMyEmployeeId(
  membershipId: string,
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("employees")
    .select("id")
    .eq("membership_id", membershipId)
    .maybeSingle();

  if (error || !data) return null;
  return data.id;
}

export async function getCompanyEmployee(
  companyId: string,
  employeeId: string,
): Promise<CompanyEmployee | null> {
  const employees = await listCompanyEmployees(companyId);
  return employees.find((row) => row.id === employeeId) ?? null;
}

export async function setEmployeeManager(
  input: unknown,
): Promise<ActionResult<void>> {
  const parsed = setEmployeeManagerSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);

  const { companyId, employeeId, managerId } = parsed.data;
  if (managerId === employeeId) {
    return fail("VALIDATION", "A person cannot be their own line manager.");
  }

  const supabase = await createClient();

  if (managerId) {
    const { data: manager } = await supabase
      .from("employees")
      .select("id, company_id, memberships(role)")
      .eq("id", managerId)
      .maybeSingle();
    const role = membershipRole(manager?.memberships);
    if (!manager || manager.company_id !== companyId || role !== "manager") {
      return fail("VALIDATION", "Pick a manager who already works at this business.");
    }
  }

  const { error } = await supabase
    .from("employees")
    .update({ manager_id: managerId })
    .eq("id", employeeId)
    .eq("company_id", companyId);

  if (error) {
    return fail("FORBIDDEN", "Could not change who they report to.");
  }

  revalidatePath(`/bookkeeper/businesses/${companyId}`);
  revalidatePath(`/bookkeeper/businesses/${companyId}/employees/${employeeId}`);
  revalidatePath("/manager");
  revalidatePath("/manager/team");
  revalidatePath("/manager/approvals");
  return ok(undefined);
}

/**
 * Bookkeepers can write entitlements; this fills any missing rows for the
 * current year so a person who joined before 0004 still has a balance.
 */
export async function ensureEmployeeEntitlements(
  companyId: string,
  employeeId: string,
  startDate: string,
): Promise<void> {
  const supabase = await createClient();
  const year = new Date().getFullYear();

  const { data: types } = await supabase
    .from("leave_types")
    .select("id, accrual_days_per_month")
    .eq("company_id", companyId)
    .eq("is_active", true);

  if (!types?.length) return;

  await supabase.from("leave_entitlements").upsert(
    types.map((type) => ({
      company_id: companyId,
      employee_id: employeeId,
      leave_type_id: type.id,
      year,
      entitled_days: entitledDaysForYear(
        Number(type.accrual_days_per_month),
        startDate,
        year,
      ),
    })),
    { onConflict: "employee_id,leave_type_id,year", ignoreDuplicates: true },
  );
}

/**
 * Payslip "יתרה" is remaining days after payroll. Store entitled so that
 * available = remaining, without double-counting days already used in the app.
 */
export async function applyPayslipLeaveBalances(input: {
  companyId: string;
  employeeId: string;
  year: number;
  month: number;
  vacationDays: number | null;
  sickDays: number | null;
  actorId: string;
}): Promise<void> {
  if (input.vacationDays === null && input.sickDays === null) return;

  const supabase = await createClient();
  const { data: types } = await supabase
    .from("leave_types")
    .select("id, code")
    .eq("company_id", input.companyId)
    .eq("is_active", true);

  if (!types?.length) return;

  const { data: requests } = await supabase
    .from("time_off_requests")
    .select("leave_type_id, working_days, status, start_date")
    .eq("employee_id", input.employeeId);

  const note = `Pay slip ${String(input.month).padStart(2, "0")}/${input.year}`;

  for (const type of types) {
    const remaining =
      type.code === "vacation"
        ? input.vacationDays
        : type.code === "sick"
          ? input.sickDays
          : null;
    if (remaining === null) continue;

    const consumed = (requests ?? [])
      .filter(
        (row) =>
          row.leave_type_id === type.id &&
          new Date(row.start_date).getFullYear() === input.year &&
          (row.status === "approved" || row.status === "pending"),
      )
      .reduce((sum, row) => sum + Number(row.working_days), 0);

    await supabase.from("leave_entitlements").upsert(
      {
        company_id: input.companyId,
        employee_id: input.employeeId,
        leave_type_id: type.id,
        year: input.year,
        entitled_days: round2(remaining + consumed),
        note,
        updated_by: input.actorId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "employee_id,leave_type_id,year" },
    );
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function membershipRole(
  memberships:
    | { role: string }
    | { role: string }[]
    | null
    | undefined,
): "employee" | "manager" | null {
  const row = Array.isArray(memberships) ? memberships[0] : memberships;
  if (row?.role === "manager" || row?.role === "employee") return row.role;
  return null;
}
