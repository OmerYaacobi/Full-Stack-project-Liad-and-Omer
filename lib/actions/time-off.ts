"use server";

import { revalidatePath } from "next/cache";

import { getMyEmployeeId } from "@/lib/actions/employees";
import { listPublishedPayslipsForEmployees } from "@/lib/actions/payslips";
import { fail, fromZod, ok, type ActionResult } from "@/lib/actions/result";
import { buildPayInsights } from "@/lib/domain/insights";
import {
  calendarDateInZone,
  calendarSpanDays,
  countWorkingDays,
  monthDateBounds,
  parseMonthKey,
  rangesOverlap,
  roundDays,
} from "@/lib/domain/working-days";
import { createClient } from "@/lib/supabase/server";
import {
  decideTimeOffSchema,
  MAX_TIME_OFF_ATTACHMENTS,
  previewTimeOffSchema,
  rejectTimeOffSchema,
  timeOffRequestSchema,
} from "@/lib/validations/time-off";
import {
  ALLOWED_DOCUMENT_TYPES,
  MAX_DOCUMENT_BYTES,
  type AllowedDocumentType,
} from "@/lib/validations/documents";

export type LeaveTypeInfo = {
  id: string;
  code: string;
  name: string;
  isPaid: boolean;
  accrualDaysPerMonth: number;
  requiresApproval: boolean;
};

export type LeaveBalance = {
  leaveTypeId: string;
  code: string;
  name: string;
  year: number;
  entitledDays: number;
  usedDays: number;
  pendingDays: number;
  availableDays: number;
  tracksBalance: boolean;
};

export type TimeOffRequest = {
  id: string;
  leaveTypeId: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  workingDays: number;
  unscheduled: boolean;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  createdAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  employeeId: string;
  employeeName?: string | null;
  companyId: string;
  companyName?: string | null;
  attachments: TimeOffAttachment[];
};

export type TimeOffAttachment = {
  id: string;
  title: string;
  fileSize: number;
};

export type TimeOffPreview = {
  calendarDays: number;
  workingDays: number;
  availableDays: number | null;
  remainingDays: number | null;
  tracksBalance: boolean;
};

export type OverlappingTeammate = {
  employeeName: string;
  startDate: string;
  endDate: string;
  status: string;
};

export type PendingApproval = TimeOffRequest & {
  remainingAfter: number | null;
  overlaps: OverlappingTeammate[];
};

export type DirectReportSummary = {
  id: string;
  fullName: string;
  jobTitle: string | null;
  department: string | null;
  vacationAvailable: number | null;
  sickAvailable: number | null;
  pendingRequests: number;
  latestNet: number | null;
  latestYear: number | null;
  latestMonth: number | null;
  averageNet: number | null;
};

export type CalendarAbsence = {
  id: string;
  employeeName: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: "pending" | "approved";
};

export type ManagerCalendar = {
  year: number;
  month: number;
  today: string;
  weekendDays: number[];
  absences: CalendarAbsence[];
};

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function listLeaveTypes(companyId: string): Promise<LeaveTypeInfo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leave_types")
    .select("id, code, name, is_paid, accrual_days_per_month, requires_approval")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) return [];
  return (data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    isPaid: row.is_paid,
    accrualDaysPerMonth: Number(row.accrual_days_per_month),
    requiresApproval: row.requires_approval,
  }));
}

export async function listMyLeaveBalances(
  membershipId: string,
  companyId: string,
): Promise<LeaveBalance[]> {
  const employeeId = await getMyEmployeeId(membershipId);
  if (!employeeId) return [];
  const supabase = await createClient();
  await supabase.rpc("ensure_my_leave_entitlements");
  return listEmployeeLeaveBalances(companyId, employeeId);
}

export async function listEmployeeLeaveBalances(
  companyId: string,
  employeeId: string,
): Promise<LeaveBalance[]> {
  const supabase = await createClient();
  const year = new Date().getFullYear();
  const types = await listLeaveTypes(companyId);
  if (types.length === 0) return [];

  const [{ data: entitlements }, { data: requests }] = await Promise.all([
    supabase
      .from("leave_entitlements")
      .select("leave_type_id, entitled_days, carried_over_days, adjustment_days, year")
      .eq("employee_id", employeeId)
      .eq("year", year),
    supabase
      .from("time_off_requests")
      .select("leave_type_id, working_days, status, start_date")
      .eq("employee_id", employeeId),
  ]);

  return types.map((type) => {
    const entitlement = (entitlements ?? []).find(
      (row) => row.leave_type_id === type.id,
    );
    const entitled = entitlement
      ? Number(entitlement.entitled_days) +
        Number(entitlement.carried_over_days) +
        Number(entitlement.adjustment_days)
      : 0;
    const ofType = (requests ?? []).filter(
      (row) =>
        row.leave_type_id === type.id &&
        new Date(row.start_date).getFullYear() === year,
    );
    const used = ofType
      .filter((row) => row.status === "approved")
      .reduce((sum, row) => sum + Number(row.working_days), 0);
    const pending = ofType
      .filter((row) => row.status === "pending")
      .reduce((sum, row) => sum + Number(row.working_days), 0);
    const tracksBalance = type.accrualDaysPerMonth > 0;
    return {
      leaveTypeId: type.id,
      code: type.code,
      name: type.name,
      year,
      entitledDays: roundDays(entitled),
      usedDays: roundDays(used),
      pendingDays: roundDays(pending),
      availableDays: roundDays(entitled - used - pending),
      tracksBalance,
    };
  });
}

export async function listMyTimeOffRequests(
  membershipId: string,
): Promise<TimeOffRequest[]> {
  const employeeId = await getMyEmployeeId(membershipId);
  if (!employeeId) return [];
  return listRequests({ employeeId });
}

export async function previewTimeOff(
  input: unknown,
): Promise<ActionResult<TimeOffPreview>> {
  const parsed = previewTimeOffSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);

  const ctx = await requireEmployeeContext();
  if (!ctx.ok) return ctx;

  const workingDays = await workingDaysFor(
    ctx.data.supabase,
    ctx.data.companyId,
    parsed.data.startDate,
    parsed.data.endDate,
  );
  if (workingDays === null) {
    return fail("INTERNAL", "Could not count working days. Try again.");
  }

  const balances = await listEmployeeLeaveBalances(
    ctx.data.companyId,
    ctx.data.employeeId,
  );
  const balance = balances.find((row) => row.leaveTypeId === parsed.data.leaveTypeId);
  const available = balance?.availableDays ?? null;
  const tracksBalance = balance?.tracksBalance ?? false;

  return ok({
    calendarDays: calendarSpanDays(parsed.data.startDate, parsed.data.endDate) + 1,
    workingDays,
    availableDays: available,
    remainingDays:
      tracksBalance && available !== null
        ? roundDays(available - workingDays)
        : null,
    tracksBalance,
  });
}

export async function submitTimeOffRequest(
  _previous: ActionResult<void> | null,
  formData: FormData,
): Promise<ActionResult<void>> {
  const parsed = timeOffRequestSchema.safeParse({
    leaveTypeId: formData.get("leaveTypeId"),
    useRemaining: formData.get("useRemaining") ?? "",
    startDate: formData.get("startDate") ?? "",
    endDate: formData.get("endDate") ?? "",
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return fromZod(parsed.error);

  const ctx = await requireEmployeeContext();
  if (!ctx.ok) return ctx;
  const { supabase, companyId, employeeId, timezone } = ctx.data;

  const today = calendarDateInZone(timezone);
  const balances = await listEmployeeLeaveBalances(companyId, employeeId);
  const balance = balances.find((row) => row.leaveTypeId === parsed.data.leaveTypeId);
  if (!balance) {
    return fail("VALIDATION", "Pick a leave type that this business uses.", {
      leaveTypeId: ["Pick a leave type that this business uses."],
    });
  }

  let startDate = parsed.data.startDate ?? "";
  let endDate = parsed.data.endDate ?? "";
  let workingDays = 0;
  let unscheduled = false;

  if (parsed.data.useRemaining) {
    if (!balance.tracksBalance) {
      return fail(
        "VALIDATION",
        "This leave type does not keep a remaining balance. Pick dates instead.",
        { leaveTypeId: ["This leave type does not keep a remaining balance."] },
      );
    }
    if (balance.availableDays <= 0) {
      return fail("VALIDATION", "You have no remaining days to request.", {
        useRemaining: ["You have no remaining days to request."],
      });
    }
    unscheduled = true;
    startDate = today;
    endDate = today;
    workingDays = balance.availableDays;
  } else {
    if (startDate < today) {
      return fail("VALIDATION", "Pick today or a future date.", {
        startDate: ["Pick today or a future date."],
      });
    }

    const counted = await workingDaysFor(
      supabase,
      companyId,
      startDate,
      endDate,
    );
    if (counted === null) {
      return fail("INTERNAL", "Could not count working days. Try again.");
    }
    if (counted === 0) {
      return fail("VALIDATION", "Those dates contain no working days.", {
        endDate: ["Those dates contain no working days."],
      });
    }
    workingDays = counted;
    if (balance.tracksBalance && balance.availableDays < workingDays) {
      return fail(
        "VALIDATION",
        `You have ${balance.availableDays} days available but requested ${workingDays}.`,
        { endDate: [`You have ${balance.availableDays} days available.`] },
      );
    }
  }

  const files = [...formData.getAll("attachments")].filter(
    (value): value is File => value instanceof File && value.size > 0,
  );
  if (files.length > MAX_TIME_OFF_ATTACHMENTS) {
    return fail("VALIDATION", `You can attach at most ${MAX_TIME_OFF_ATTACHMENTS} files.`, {
      attachments: [`You can attach at most ${MAX_TIME_OFF_ATTACHMENTS} files.`],
    });
  }
  for (const file of files) {
    const fileError = await checkAttachment(file);
    if (fileError) {
      return fail("VALIDATION", fileError, { attachments: [fileError] });
    }
  }

  const { data: created, error } = await supabase
    .from("time_off_requests")
    .insert({
      company_id: companyId,
      employee_id: employeeId,
      leave_type_id: parsed.data.leaveTypeId,
      start_date: startDate,
      end_date: endDate,
      working_days: workingDays,
      unscheduled,
      reason: parsed.data.reason ?? null,
    })
    .select("id")
    .single();

  if (error || !created) return mapTimeOffError(error ?? { message: "Could not save the request." });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Your session has expired. Sign in again.");

  for (const file of files) {
    const extension =
      ALLOWED_DOCUMENT_TYPES[file.type as AllowedDocumentType] ?? "bin";
    const path = `${companyId}/${employeeId}/${created.id}/${crypto.randomUUID()}.${extension}`;
    const upload = await supabase.storage.from("time_off").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (upload.error) continue;

    const title = file.name.replace(/\.[^.]+$/, "").slice(0, 160) || "Attachment";
    const { error: attachError } = await supabase.from("time_off_attachments").insert({
      request_id: created.id,
      company_id: companyId,
      employee_id: employeeId,
      title,
      file_path: path,
      file_size: file.size,
      uploaded_by: user.id,
    });
    if (attachError) {
      await supabase.storage.from("time_off").remove([path]);
    }
  }

  revalidateTimeOff(companyId);
  return ok(undefined);
}

export async function cancelTimeOffRequest(
  requestId: string,
): Promise<ActionResult<void>> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_time_off", {
    p_request_id: requestId,
  });
  if (error) return mapTimeOffError(error);
  revalidateTimeOff();
  return ok(undefined);
}

export async function approveTimeOffRequest(
  requestId: string,
  note?: string,
): Promise<ActionResult<void>> {
  const parsed = decideTimeOffSchema.safeParse({ requestId, note: note ?? "" });
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_time_off", {
    p_request_id: parsed.data.requestId,
    p_approve: true,
    p_note: parsed.data.note ?? null,
  });
  if (error) return mapTimeOffError(error);
  revalidateTimeOff();
  return ok(undefined);
}

export async function rejectTimeOffRequest(
  requestId: string,
  note: string,
): Promise<ActionResult<void>> {
  const parsed = rejectTimeOffSchema.safeParse({ requestId, note });
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_time_off", {
    p_request_id: parsed.data.requestId,
    p_approve: false,
    p_note: parsed.data.note,
  });
  if (error) return mapTimeOffError(error);
  revalidateTimeOff();
  return ok(undefined);
}

export async function listPendingApprovals(
  membershipId: string | null,
  companyId?: string | null,
): Promise<PendingApproval[]> {
  const ownId = membershipId ? await getMyEmployeeId(membershipId) : null;
  return buildPendingApprovals({
    companyId: companyId ?? undefined,
    excludeEmployeeId: ownId,
  });
}

export async function listFirmPendingApprovals(): Promise<PendingApproval[]> {
  return buildPendingApprovals({});
}

async function buildPendingApprovals(filter: {
  companyId?: string;
  excludeEmployeeId?: string | null;
}): Promise<PendingApproval[]> {
  const pending = await listRequests({
    status: "pending",
    companyId: filter.companyId,
  });
  const visible = filter.excludeEmployeeId
    ? pending.filter((row) => row.employeeId !== filter.excludeEmployeeId)
    : pending;
  if (visible.length === 0) return [];

  const teamIds = [...new Set(visible.map((row) => row.employeeId))];
  const teamRequests = await listRequests({
    employeeIds: teamIds,
    companyId: filter.companyId,
  });
  const active = teamRequests.filter(
    (row) => row.status === "pending" || row.status === "approved",
  );

  const balancesByEmployee = new Map<string, LeaveBalance[]>();
  await Promise.all(
    visible.map(async (row) => {
      if (balancesByEmployee.has(row.employeeId)) return;
      balancesByEmployee.set(
        row.employeeId,
        await listEmployeeLeaveBalances(row.companyId, row.employeeId),
      );
    }),
  );

  return visible.map((request) => {
    const balance = (balancesByEmployee.get(request.employeeId) ?? []).find(
      (row) => row.leaveTypeId === request.leaveTypeId,
    );
    const overlaps = active
      .filter(
        (other) =>
          other.id !== request.id &&
          other.employeeId !== request.employeeId &&
          other.companyId === request.companyId &&
          !request.unscheduled &&
          !other.unscheduled &&
          rangesOverlap(
            request.startDate,
            request.endDate,
            other.startDate,
            other.endDate,
          ),
      )
      .map((other) => ({
        employeeName: other.employeeName ?? "Someone on the team",
        startDate: other.startDate,
        endDate: other.endDate,
        status: other.status,
      }));

    return {
      ...request,
      remainingAfter: balance?.tracksBalance
        ? roundDays(balance.availableDays)
        : null,
      overlaps,
    };
  });
}

export async function listDirectReportSummaries(
  membershipId: string,
  companyId: string,
): Promise<DirectReportSummary[]> {
  const managerId = await getMyEmployeeId(membershipId);
  if (!managerId) return [];

  const supabase = await createClient();
  const { data: reports, error } = await supabase
    .from("employees")
    .select("id, full_name, job_title, department")
    .eq("company_id", companyId)
    .eq("manager_id", managerId)
    .in("status", ["active", "on_leave"])
    .order("full_name", { ascending: true });

  if (error || !reports?.length) return [];

  const slipsByEmployee = await listPublishedPayslipsForEmployees(
    companyId,
    reports.map((row) => row.id),
  );

  const summaries = await Promise.all(
    reports.map(async (row) => {
      const [balances, requests] = await Promise.all([
        listEmployeeLeaveBalances(companyId, row.id),
        listRequests({ employeeId: row.id }),
      ]);
      const vacation = balances.find((item) => item.code === "vacation");
      const sick = balances.find((item) => item.code === "sick");
      const insights = buildPayInsights(slipsByEmployee.get(row.id) ?? []);
      return {
        id: row.id,
        fullName: row.full_name,
        jobTitle: row.job_title,
        department: row.department,
        vacationAvailable: vacation?.availableDays ?? null,
        sickAvailable: sick?.availableDays ?? null,
        pendingRequests: requests.filter((item) => item.status === "pending").length,
        latestNet: insights.latest?.netPay ?? null,
        latestYear: insights.latest?.year ?? null,
        latestMonth: insights.latest?.month ?? null,
        averageNet: insights.rollingAverage,
      };
    }),
  );

  return summaries;
}

export async function managerOverviewStats(
  membershipId: string,
  companyId: string,
): Promise<{
  pending: number;
  reports: number;
  awayThisMonth: number;
  vacationRemaining: number | null;
  sickRemaining: number | null;
  averageLatestNet: number | null;
}> {
  const [pending, reports] = await Promise.all([
    listPendingApprovals(membershipId, companyId),
    listDirectReportSummaries(membershipId, companyId),
  ]);

  const vacation = reports
    .map((row) => row.vacationAvailable)
    .filter((value): value is number => value !== null);
  const sick = reports
    .map((row) => row.sickAvailable)
    .filter((value): value is number => value !== null);
  const latestNets = reports
    .map((row) => row.latestNet)
    .filter((value): value is number => value !== null);

  const empty = {
    pending: pending.length,
    reports: reports.length,
    awayThisMonth: 0,
    vacationRemaining: vacation.length ? vacation.reduce((sum, value) => sum + value, 0) : null,
    sickRemaining: sick.length ? sick.reduce((sum, value) => sum + value, 0) : null,
    averageLatestNet:
      latestNets.length === 0
        ? null
        : latestNets.reduce((sum, value) => sum + value, 0) / latestNets.length,
  };

  const managerId = await getMyEmployeeId(membershipId);
  if (!managerId) {
    return empty;
  }

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const monthEnd = `${monthEndDate.getFullYear()}-${String(monthEndDate.getMonth() + 1).padStart(2, "0")}-${String(monthEndDate.getDate()).padStart(2, "0")}`;

  const teamIds = reports.map((row) => row.id);
  const teamRequests =
    teamIds.length === 0
      ? []
      : await listRequests({ employeeIds: teamIds, status: "approved" });
  const awayThisMonth = new Set(
    teamRequests
      .filter(
        (row) =>
          !row.unscheduled &&
          rangesOverlap(row.startDate, row.endDate, monthStart, monthEnd),
      )
      .map((row) => row.employeeId),
  ).size;

  return {
    ...empty,
    awayThisMonth,
  };
}

export async function listManagerCalendar(
  companyId: string,
  monthParam?: string,
): Promise<ManagerCalendar> {
  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("timezone, weekend_days")
    .eq("id", companyId)
    .maybeSingle();

  const timezone = company?.timezone || "Asia/Jerusalem";
  const weekendDays = Array.isArray(company?.weekend_days)
    ? company.weekend_days.map(Number)
    : [5, 6];
  const today = calendarDateInZone(timezone);
  const { year, month } = parseMonthKey(monthParam, {
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  });
  const { start, end } = monthDateBounds(year, month);

  const { data, error } = await supabase
    .from("time_off_requests")
    .select(
      "id, start_date, end_date, reason, status, unscheduled, leave_types(name), employees(full_name)",
    )
    .eq("company_id", companyId)
    .in("status", ["pending", "approved"])
    .eq("unscheduled", false)
    .lte("start_date", end)
    .gte("end_date", start)
    .order("start_date", { ascending: true });

  if (error) {
    return { year, month, today, weekendDays, absences: [] };
  }

  const absences: CalendarAbsence[] = (data ?? []).map((row) => {
    const leaveType = Array.isArray(row.leave_types)
      ? row.leave_types[0]
      : row.leave_types;
    const employee = Array.isArray(row.employees)
      ? row.employees[0]
      : row.employees;
    return {
      id: row.id,
      employeeName: employee?.full_name ?? "Someone on the team",
      leaveTypeName: leaveType?.name ?? "Leave",
      startDate: row.start_date,
      endDate: row.end_date,
      reason: row.reason,
      status: row.status as CalendarAbsence["status"],
    };
  });

  return { year, month, today, weekendDays, absences };
}

async function requireEmployeeContext(): Promise<
  ActionResult<{
    supabase: SupabaseClient;
    companyId: string;
    employeeId: string;
    timezone: string;
  }>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return fail("UNAUTHENTICATED", "Your session has expired. Sign in again.");
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("id, company_id, companies(timezone)")
    .eq("profile_id", user.id)
    .eq("is_active", true)
    .in("role", ["employee", "manager"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return fail("FORBIDDEN", "You need a company membership to request time off.");
  }

  const employeeId = await getMyEmployeeId(membership.id);
  if (!employeeId) {
    return fail("FORBIDDEN", "Your HR record is missing, so you cannot request time off.");
  }

  const company = Array.isArray(membership.companies)
    ? membership.companies[0]
    : membership.companies;

  return ok({
    supabase,
    companyId: membership.company_id,
    employeeId,
    timezone: company?.timezone || "Asia/Jerusalem",
  });
}

async function workingDaysFor(
  supabase: SupabaseClient,
  companyId: string,
  startDate: string,
  endDate: string,
): Promise<number | null> {
  const [{ data: company }, { data: holidays }] = await Promise.all([
    supabase
      .from("companies")
      .select("weekend_days")
      .eq("id", companyId)
      .maybeSingle(),
    supabase
      .from("company_holidays")
      .select("holiday_date, is_half_day")
      .eq("company_id", companyId)
      .gte("holiday_date", startDate)
      .lte("holiday_date", endDate),
  ]);

  if (!company) return null;

  const weekendDays = Array.isArray(company.weekend_days)
    ? company.weekend_days.map(Number)
    : [5, 6];
  const holidayMap = new Map<string, { isHalfDay: boolean }>();
  for (const row of holidays ?? []) {
    holidayMap.set(row.holiday_date, { isHalfDay: row.is_half_day });
  }

  return countWorkingDays(startDate, endDate, weekendDays, holidayMap);
}

async function listRequests(filter: {
  employeeId?: string;
  employeeIds?: string[];
  companyId?: string;
  status?: string;
}): Promise<TimeOffRequest[]> {
  const supabase = await createClient();
  let query = supabase
    .from("time_off_requests")
    .select(
      "id, company_id, leave_type_id, start_date, end_date, working_days, unscheduled, reason, status, created_at, decided_at, decision_note, employee_id, leave_types(name), employees(full_name), companies(name)",
    )
    .order("created_at", { ascending: false });

  if (filter.employeeId) query = query.eq("employee_id", filter.employeeId);
  if (filter.employeeIds) query = query.in("employee_id", filter.employeeIds);
  if (filter.companyId) query = query.eq("company_id", filter.companyId);
  if (filter.status) query = query.eq("status", filter.status);

  const { data, error } = await query;
  if (error) return [];

  const ids = (data ?? []).map((row) => row.id);
  const attachmentsByRequest = await listAttachments(ids);

  return (data ?? []).map((row) => {
    const leaveType = Array.isArray(row.leave_types)
      ? row.leave_types[0]
      : row.leave_types;
    const employee = Array.isArray(row.employees)
      ? row.employees[0]
      : row.employees;
    const company = Array.isArray(row.companies)
      ? row.companies[0]
      : row.companies;
    return {
      id: row.id,
      leaveTypeId: row.leave_type_id,
      leaveTypeName: leaveType?.name ?? "Leave",
      startDate: row.start_date,
      endDate: row.end_date,
      workingDays: Number(row.working_days),
      unscheduled: Boolean(row.unscheduled),
      reason: row.reason,
      status: row.status as TimeOffRequest["status"],
      createdAt: row.created_at,
      decidedAt: row.decided_at,
      decisionNote: row.decision_note,
      employeeId: row.employee_id,
      employeeName: employee?.full_name ?? null,
      companyId: row.company_id,
      companyName: company?.name ?? null,
      attachments: attachmentsByRequest.get(row.id) ?? [],
    };
  });
}

async function listAttachments(
  requestIds: string[],
): Promise<Map<string, TimeOffAttachment[]>> {
  const grouped = new Map<string, TimeOffAttachment[]>();
  if (requestIds.length === 0) return grouped;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("time_off_attachments")
    .select("id, request_id, title, file_size")
    .in("request_id", requestIds)
    .order("created_at", { ascending: true });

  if (error) return grouped;

  for (const row of data ?? []) {
    const list = grouped.get(row.request_id) ?? [];
    list.push({ id: row.id, title: row.title, fileSize: row.file_size });
    grouped.set(row.request_id, list);
  }
  return grouped;
}

export async function getTimeOffAttachmentUrl(
  attachmentId: string,
): Promise<ActionResult<string>> {
  const supabase = await createClient();
  const { data: attachment, error } = await supabase
    .from("time_off_attachments")
    .select("file_path")
    .eq("id", attachmentId)
    .maybeSingle();

  if (error || !attachment) {
    return fail("NOT_FOUND", "That file is no longer available.");
  }

  const { data, error: signError } = await supabase.storage
    .from("time_off")
    .createSignedUrl(attachment.file_path, 120);

  if (signError || !data) {
    return fail("INTERNAL", "Could not open that file. Try again.");
  }

  return ok(data.signedUrl);
}

async function checkAttachment(file: File): Promise<string | null> {
  if (file.size > MAX_DOCUMENT_BYTES) return "Each file must be 10 MB or smaller.";
  if (!(file.type in ALLOWED_DOCUMENT_TYPES)) {
    return "Only PDF, PNG, and JPEG files can be attached.";
  }
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const signatures: Record<AllowedDocumentType, number[][]> = {
    "application/pdf": [[0x25, 0x50, 0x44, 0x46]],
    "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    "image/jpeg": [[0xff, 0xd8, 0xff]],
  };
  const expected = signatures[file.type as AllowedDocumentType];
  const matches = expected.some((signature) =>
    signature.every((byte, index) => head[index] === byte),
  );
  if (!matches) return "That file's contents do not match its type.";
  return null;
}

function revalidateTimeOff(companyId?: string) {
  revalidatePath("/employee");
  revalidatePath("/employee/time-off");
  revalidatePath("/manager");
  revalidatePath("/manager/approvals");
  revalidatePath("/manager/calendar");
  revalidatePath("/manager/team");
  revalidatePath("/bookkeeper");
  revalidatePath("/bookkeeper/approvals");
  if (companyId) {
    revalidatePath(`/bookkeeper/businesses/${companyId}`);
  }
}

function mapTimeOffError(error: { code?: string; message?: string }): ActionResult<never> {
  const code = error.code ?? "";
  const message = error.message ?? "";

  if (code === "23P01" || /no_overlapping_active_leave|exclusion/i.test(message)) {
    return fail("CONFLICT", "You already have a request covering these dates.");
  }
  if (code === "23505" || /uniq_pending_unscheduled_leave/i.test(message)) {
    return fail(
      "CONFLICT",
      "You already have a pending request for all remaining days of this leave type.",
    );
  }
  if (/ALREADY_DECIDED/i.test(message)) {
    return fail("CONFLICT", "This request was already decided.");
  }
  if (/NOT_YOUR_TEAM/i.test(message)) {
    return fail("FORBIDDEN", "You can only decide time-off for people at this business.");
  }
  if (/CANNOT_CANCEL_DECIDED/i.test(message)) {
    return fail("CONFLICT", "Only a pending request can be cancelled.");
  }
  if (/NOT_YOUR_REQUEST/i.test(message)) {
    return fail("FORBIDDEN", "You can only cancel your own requests.");
  }
  if (/REQUEST_NOT_FOUND/i.test(message) || code === "P0002") {
    return fail("NOT_FOUND", "That request is no longer available.");
  }
  if (code === "42501" || /row-level security|not authorized|violates/i.test(message)) {
    return fail("FORBIDDEN", "You do not have permission to do that.");
  }
  return fail("INTERNAL", "Something went wrong. Please try again.");
}
