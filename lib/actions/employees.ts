"use server";

import { createClient } from "@/lib/supabase/server";

export type CompanyEmployee = {
  id: string;
  fullName: string;
  employeeNumber: string;
  jobTitle: string | null;
  department: string | null;
  status: string;
  role: "employee" | "manager" | null;
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
      "id, full_name, employee_number, job_title, department, status, memberships(role)",
    )
    .eq("company_id", companyId)
    .order("full_name", { ascending: true });

  if (error) return [];

  return (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    employeeNumber: row.employee_number,
    jobTitle: row.job_title,
    department: row.department,
    status: row.status,
    role: membershipRole(row.memberships),
  }));
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
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("employees")
    .select(
      "id, full_name, employee_number, job_title, department, status, memberships(role)",
    )
    .eq("company_id", companyId)
    .eq("id", employeeId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    fullName: data.full_name,
    employeeNumber: data.employee_number,
    jobTitle: data.job_title,
    department: data.department,
    status: data.status,
    role: membershipRole(data.memberships),
  };
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
