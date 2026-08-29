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

const employeeIdSchema = z.object({
  employeeId: z.string().uuid(),
});

const requestIdSchema = z.object({
  requestId: z.string().uuid(),
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
  return employees.filter(
    (row) => row.role === "manager" && row.status !== "terminated",
  );
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

export async function getMyEmployee(
  membershipId: string,
  companyId: string,
): Promise<CompanyEmployee | null> {
  const employeeId = await getMyEmployeeId(membershipId);
  if (!employeeId) return null;
  return getCompanyEmployee(companyId, employeeId);
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
  revalidatePath("/employee");
  return ok(undefined);
}

export type ClaimableTeammate = {
  id: string;
  fullName: string;
  jobTitle: string | null;
  managerName: string | null;
};

export type TeamJoinRequest = {
  id: string;
  createdAt: string;
  employeeId: string;
  employeeName: string;
  managerId: string;
  managerName: string;
  managerJobTitle: string | null;
};

/**
 * People at this business who do not already report to the signed-in manager
 * and have no pending ask from them. Asking still needs the other person to
 * accept before they join the team.
 */
export async function listClaimableTeammates(
  companyId: string,
  managerEmployeeId: string,
): Promise<ClaimableTeammate[]> {
  const [people, outgoing] = await Promise.all([
    listCompanyEmployees(companyId),
    listOutgoingTeamJoinRequests(managerEmployeeId),
  ]);
  const waiting = new Set(outgoing.map((row) => row.employeeId));
  return people
    .filter(
      (row) =>
        row.id !== managerEmployeeId &&
        row.managerId !== managerEmployeeId &&
        row.status !== "terminated" &&
        !waiting.has(row.id),
    )
    .map((row) => ({
      id: row.id,
      fullName: row.fullName,
      jobTitle: row.jobTitle,
      managerName: row.managerName,
    }));
}

export async function listOutgoingTeamJoinRequests(
  managerEmployeeId: string,
): Promise<TeamJoinRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("team_join_requests")
    .select("id, created_at, manager_id, employee_id")
    .eq("manager_id", managerEmployeeId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error || !data?.length) return [];

  const { data: people } = await supabase
    .from("employees")
    .select("id, full_name")
    .in(
      "id",
      data.map((row) => row.employee_id),
    );

  const names = new Map((people ?? []).map((row) => [row.id, row.full_name]));

  return data.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    employeeId: row.employee_id,
    employeeName: names.get(row.employee_id) ?? "Employee",
    managerId: row.manager_id,
    managerName: "",
    managerJobTitle: null,
  }));
}

export async function listIncomingTeamJoinRequests(
  membershipId: string,
): Promise<TeamJoinRequest[]> {
  const employeeId = await getMyEmployeeId(membershipId);
  if (!employeeId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("team_join_requests")
    .select("id, created_at, manager_id, employee_id")
    .eq("employee_id", employeeId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error || !data?.length) return [];

  const { data: managers } = await supabase
    .from("employees")
    .select("id, full_name, job_title")
    .in(
      "id",
      data.map((row) => row.manager_id),
    );

  const byId = new Map((managers ?? []).map((row) => [row.id, row]));

  return data.map((row) => {
    const manager = byId.get(row.manager_id);
    return {
      id: row.id,
      createdAt: row.created_at,
      employeeId: row.employee_id,
      employeeName: "",
      managerId: row.manager_id,
      managerName: manager?.full_name ?? "A manager",
      managerJobTitle: manager?.job_title ?? null,
    };
  });
}

export async function requestDirectReport(
  employeeId: string,
): Promise<ActionResult<void>> {
  const parsed = employeeIdSchema.safeParse({ employeeId });
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { data: employee } = await supabase
    .from("employees")
    .select("id, company_id")
    .eq("id", parsed.data.employeeId)
    .maybeSingle();

  const { error } = await supabase.rpc("request_direct_report", {
    p_employee_id: parsed.data.employeeId,
  });
  if (error) return mapPeopleError(error);

  revalidateTeamPaths(employee?.company_id ?? null);
  revalidatePath(`/manager/team/${parsed.data.employeeId}`);
  return ok(undefined);
}

export async function decideTeamJoin(
  requestId: string,
  approve: boolean,
): Promise<ActionResult<void>> {
  const parsed = requestIdSchema.safeParse({ requestId });
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_team_join", {
    p_request_id: parsed.data.requestId,
    p_approve: approve,
  });
  if (error) return mapPeopleError(error);

  revalidateTeamPaths(null);
  revalidatePath("/employee");
  revalidatePath("/employee/time-off");
  return ok(undefined);
}

export async function cancelTeamJoinRequest(
  requestId: string,
): Promise<ActionResult<void>> {
  const parsed = requestIdSchema.safeParse({ requestId });
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_team_join_request", {
    p_request_id: parsed.data.requestId,
  });
  if (error) return mapPeopleError(error);

  revalidateTeamPaths(null);
  revalidatePath("/employee");
  return ok(undefined);
}

export async function removeDirectReport(
  employeeId: string,
): Promise<ActionResult<void>> {
  const parsed = employeeIdSchema.safeParse({ employeeId });
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { data: employee } = await supabase
    .from("employees")
    .select("id, company_id")
    .eq("id", parsed.data.employeeId)
    .maybeSingle();

  const { error } = await supabase.rpc("remove_direct_report", {
    p_employee_id: parsed.data.employeeId,
  });
  if (error) return mapPeopleError(error);

  revalidateTeamPaths(employee?.company_id ?? null);
  revalidatePath(`/manager/team/${parsed.data.employeeId}`);
  return ok(undefined);
}

export async function terminateEmployee(
  employeeId: string,
): Promise<ActionResult<void>> {
  const parsed = employeeIdSchema.safeParse({ employeeId });
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { data: employee } = await supabase
    .from("employees")
    .select("id, company_id")
    .eq("id", parsed.data.employeeId)
    .maybeSingle();

  const { error } = await supabase.rpc("terminate_employee", {
    p_employee_id: parsed.data.employeeId,
  });
  if (error) return mapPeopleError(error);

  revalidateTeamPaths(employee?.company_id ?? null);
  if (employee?.company_id) {
    revalidatePath(`/bookkeeper/businesses/${employee.company_id}/employees/${employee.id}`);
    revalidatePath("/bookkeeper");
    revalidatePath("/bookkeeper/periods");
  }
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

/**
 * Allows bookkeepers / admins to manually set or adjust an employee's starting or current available leave balances.
 * Calculates entitled_days = desired_available + already_consumed_this_year so available balance exactly matches.
 */
export async function updateEmployeeLeaveBalances(input: {
  companyId: string;
  employeeId: string;
  vacationDays: number;
  sickDays: number;
}): Promise<ActionResult<void>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return fail("UNAUTHENTICATED", "You must be signed in.");
  }

  const year = new Date().getFullYear();
  const { data: types } = await supabase
    .from("leave_types")
    .select("id, code")
    .eq("company_id", input.companyId)
    .eq("is_active", true);

  if (!types?.length) {
    return fail("NOT_FOUND", "No active leave types found for this company.");
  }

  const { data: requests } = await supabase
    .from("time_off_requests")
    .select("leave_type_id, working_days, status, start_date")
    .eq("employee_id", input.employeeId);

  const note = `Manual balance adjustment (${new Date().toLocaleDateString("en-GB")})`;

  for (const type of types) {
    const desiredAvailable =
      type.code === "vacation"
        ? input.vacationDays
        : type.code === "sick"
          ? input.sickDays
          : null;
    if (desiredAvailable === null) continue;

    const consumed = (requests ?? [])
      .filter(
        (row) =>
          row.leave_type_id === type.id &&
          new Date(row.start_date).getFullYear() === year &&
          (row.status === "approved" || row.status === "pending"),
      )
      .reduce((sum, row) => sum + Number(row.working_days), 0);

    const entitled_days = round2(Math.max(0, desiredAvailable + consumed));

    const { error } = await supabase.from("leave_entitlements").upsert(
      {
        company_id: input.companyId,
        employee_id: input.employeeId,
        leave_type_id: type.id,
        year,
        entitled_days,
        note,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "employee_id,leave_type_id,year" },
    );

    if (error) {
      return fail("INTERNAL", `Failed to update ${type.code} balance: ${error.message}`);
    }
  }

  revalidatePath(`/bookkeeper/businesses/${input.companyId}/employees/${input.employeeId}`);
  revalidatePath(`/employee/time-off`);
  revalidatePath(`/employee`);
  revalidatePath(`/manager/team`);

  return ok(undefined);
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

function revalidateTeamPaths(companyId: string | null) {
  revalidatePath("/manager");
  revalidatePath("/manager/team");
  revalidatePath("/manager/approvals");
  revalidatePath("/employee");
  if (companyId) {
    revalidatePath(`/bookkeeper/businesses/${companyId}`);
  }
}

function mapPeopleError(error: { code?: string; message?: string }): ActionResult<never> {
  const message = error.message ?? "";
  if (/NOT_THEIR_MANAGER/i.test(message)) {
    return fail("FORBIDDEN", "You can only remove people who report to you.");
  }
  if (/CANNOT_MANAGE_SELF/i.test(message)) {
    return fail("VALIDATION", "You cannot add yourself as a report.");
  }
  if (/NOT_A_MANAGER/i.test(message)) {
    return fail("FORBIDDEN", "Only a manager at this business can add reports.");
  }
  if (/NOT_BOOKKEEPER/i.test(message) || error.code === "42501") {
    return fail("FORBIDDEN", "You do not have permission to do that.");
  }
  if (/ALREADY_REMOVED/i.test(message)) {
    return fail("CONFLICT", "That person is already off the payroll.");
  }
  if (/ALREADY_PENDING/i.test(message)) {
    return fail("CONFLICT", "You already asked this person. Wait for them to answer.");
  }
  if (/ALREADY_ON_TEAM/i.test(message)) {
    return fail("CONFLICT", "They already report to you.");
  }
  if (/ALREADY_DECIDED/i.test(message)) {
    return fail("CONFLICT", "That ask was already answered.");
  }
  if (/NOT_YOUR_REQUEST/i.test(message)) {
    return fail("FORBIDDEN", "That ask is not yours to answer.");
  }
  if (/REQUEST_NOT_FOUND/i.test(message)) {
    return fail("NOT_FOUND", "That ask is no longer open.");
  }
  if (/EMPLOYEE_NOT_FOUND/i.test(message) || error.code === "P0002") {
    return fail("NOT_FOUND", "That person is no longer on this payroll.");
  }
  return fail("INTERNAL", "Could not update that person. Try again.");
}
