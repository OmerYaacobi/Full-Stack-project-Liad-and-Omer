"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  createInvitationSchema,
  type CreateInvitationInput,
} from "@/lib/validations/auth";

export async function createInvitationLink(input: CreateInvitationInput) {
  const parsed = createInvitationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Unauthorized" };
  }

  // Calculate expires_at
  const expiresInDays = parsed.data.expiresInDays || 7;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  let managerId: string | null = parsed.data.managerId ? parsed.data.managerId : null;
  if (managerId) {
    const { data: manager } = await supabase
      .from("employees")
      .select("id, company_id, memberships(role)")
      .eq("id", managerId)
      .maybeSingle();
    const memberships = manager?.memberships as
      | { role?: string }
      | { role?: string }[]
      | null
      | undefined;
    const role = Array.isArray(memberships)
      ? memberships[0]?.role
      : memberships?.role;
    if (!manager || manager.company_id !== parsed.data.companyId || role !== "manager") {
      return { ok: false, error: "Pick a manager who already works at this business." };
    }
  }

  const { data: invitation, error } = await supabase
    .from("invitations")
    .insert({
      company_id: parsed.data.companyId,
      role: parsed.data.role,
      email: parsed.data.email || null,
      created_by: user.id,
      expires_at: expiresAt.toISOString(),
      manager_id: managerId,
    })
    .select("id, token, role, company_id, expires_at")
    .single();

  if (error) {
    if (/manager_id/i.test(error.message)) {
      return {
        ok: false,
        error: "This database is missing the line-manager column. Run 0004_time_off.sql in Supabase.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath(`/bookkeeper/businesses/${parsed.data.companyId}`);

  return {
    ok: true,
    data: {
      ...invitation,
      inviteUrl: `/invite/${invitation.token}`,
    },
  };
}

export async function getInvitationDetails(token: string) {
  if (!token || typeof token !== "string") {
    return { ok: false, error: "Invalid invitation token" };
  }

  const supabase = await createClient();
  const cleanToken = token.trim();

  // 1. Try RPC resolver (Security Definer, works for anonymous/incognito guests)
  const { data: rpcData, error: rpcError } = await supabase
    .rpc("get_invitation_by_token", { p_token: cleanToken });

  let invitation: {
    token: string;
    role: "employee" | "manager" | null;
    email: string | null;
    expires_at: string;
    used_at: string | null;
    reusable: boolean;
    companyName: string;
    companyTaxId: string;
  } | null = null;

  if (!rpcError && rpcData && rpcData.length > 0) {
    const row = rpcData[0];
    invitation = {
      token: row.token,
      role: row.role,
      email: row.email,
      expires_at: row.expires_at,
      used_at: row.used_at,
      reusable: Boolean(row.reusable),
      companyName: row.company_name,
      companyTaxId: row.company_tax_id,
    };
  } else {
    const { data: directData } = await supabase
      .from("invitations")
      .select(`
        id,
        token,
        role,
        email,
        expires_at,
        used_at,
        reusable,
        companies (
          id,
          name,
          tax_id
        )
      `)
      .eq("token", cleanToken)
      .maybeSingle();

    if (directData) {
      const company = Array.isArray(directData.companies)
        ? directData.companies[0]
        : directData.companies;
      invitation = {
        token: directData.token,
        role: directData.role,
        email: directData.email,
        expires_at: directData.expires_at,
        used_at: directData.used_at,
        reusable: Boolean(directData.reusable),
        companyName: company?.name || "Company",
        companyTaxId: company?.tax_id || "",
      };
    }
  }

  if (!invitation) {
    return { ok: false, error: "Invitation not found or has been removed." };
  }

  if (!invitation.reusable && invitation.used_at) {
    return { ok: false, error: "This invitation link has already been used." };
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return {
      ok: false,
      error: "This invitation link has expired. Please request a new one from your company administrator.",
    };
  }

  return {
    ok: true,
    data: {
      token: invitation.token,
      role: invitation.role === "manager" ? "manager" : "employee",
      reusable: invitation.reusable,
      email: invitation.email,
      companyName: invitation.companyName || "Company",
      companyTaxId: invitation.companyTaxId || "",
    },
  };
}

export async function listBusinessInvitations(companyId: string) {
  if (!companyId) {
    return { ok: false, error: "Missing company ID", data: [] };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Unauthorized", data: [] };
  }

  const { data: invitations, error } = await supabase
    .from("invitations")
    .select(`
      id,
      token,
      role,
      email,
      expires_at,
      used_at,
      created_at,
      reusable
    `)
    .eq("company_id", companyId)
    .eq("reusable", false)
    .order("created_at", { ascending: false });

  if (error) {
    return { ok: false, error: error.message, data: [] };
  }

  return { ok: true, data: invitations || [] };
}

export type CompanyJoinLink = {
  role: "employee" | "manager";
  token: string;
  expiresAt: string;
  inviteUrl: string;
};

export type CompanyJoinLinks = {
  employee: CompanyJoinLink;
  manager: CompanyJoinLink;
};

type JoinResult =
  | { ok: true; data: CompanyJoinLinks }
  | { ok: false; error: string };

type OneJoinResult =
  | { ok: true; data: CompanyJoinLink }
  | { ok: false; error: string };

function toJoinLink(row: {
  role: "employee" | "manager" | string;
  token: string;
  expires_at: string;
}): CompanyJoinLink {
  const role = row.role === "manager" ? "manager" : "employee";
  return {
    role,
    token: row.token,
    expiresAt: row.expires_at,
    inviteUrl: `/invite/${row.token}`,
  };
}

async function readReusableInvites(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
) {
  const { data, error } = await supabase
    .from("invitations")
    .select("id, token, expires_at, role")
    .eq("company_id", companyId)
    .eq("reusable", true);

  if (error || !data?.length) return [];
  return data as {
    id: string;
    token: string;
    expires_at: string;
    role: "employee" | "manager";
  }[];
}

async function insertReusableInvite(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  userId: string,
  role: "employee" | "manager",
) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90);
  return supabase.from("invitations").insert({
    company_id: companyId,
    role,
    reusable: true,
    created_by: userId,
    expires_at: expiresAt.toISOString(),
  });
}

export async function getOrCreateCompanyJoinLink(
  companyId: string,
): Promise<JoinResult> {
  if (!companyId) {
    return { ok: false, error: "Missing company ID" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Unauthorized" };
  }

  let rows = await readReusableInvites(supabase, companyId);
  const have = new Set(rows.map((row) => row.role));

  for (const role of ["employee", "manager"] as const) {
    if (have.has(role)) continue;
    const { error } = await insertReusableInvite(
      supabase,
      companyId,
      user.id,
      role,
    );
    if (error && !/uniq_company_reusable_invite|23505/.test(error.message)) {
      if (/reusable/i.test(error.message)) {
        return {
          ok: false,
          error:
            "This database is missing team join links. Run 0012_company_join_links.sql in Supabase.",
        };
      }
      return { ok: false, error: error.message };
    }
  }

  rows = await readReusableInvites(supabase, companyId);
  const employee = rows.find((row) => row.role === "employee");
  const manager = rows.find((row) => row.role === "manager");
  if (!employee || !manager) {
    return { ok: false, error: "Could not create team join links." };
  }

  const now = Date.now();
  if (new Date(employee.expires_at).getTime() < now) {
    const rotated = await rotateCompanyJoinLink(companyId, "employee");
    if (!rotated.ok) return rotated;
  }
  if (new Date(manager.expires_at).getTime() < now) {
    const rotated = await rotateCompanyJoinLink(companyId, "manager");
    if (!rotated.ok) return rotated;
  }

  rows = await readReusableInvites(supabase, companyId);
  const employeeRow = rows.find((row) => row.role === "employee");
  const managerRow = rows.find((row) => row.role === "manager");
  if (!employeeRow || !managerRow) {
    return { ok: false, error: "Could not create team join links." };
  }

  return {
    ok: true,
    data: {
      employee: toJoinLink(employeeRow),
      manager: toJoinLink(managerRow),
    },
  };
}

export async function rotateCompanyJoinLink(
  companyId: string,
  role: "employee" | "manager",
): Promise<OneJoinResult> {
  if (!companyId) {
    return { ok: false, error: "Missing company ID" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Unauthorized" };
  }

  const rows = await readReusableInvites(supabase, companyId);
  const existing = rows.find((row) => row.role === role);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90);
  const token =
    crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "").slice(0, 8);

  if (existing) {
    const { data, error } = await supabase
      .from("invitations")
      .update({
        token,
        expires_at: expiresAt.toISOString(),
        used_at: null,
        used_by: null,
      })
      .eq("id", existing.id)
      .select("token, expires_at, role")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message || "Could not refresh the link." };
    }

    revalidatePath(`/bookkeeper/businesses/${companyId}`);
    return { ok: true, data: toJoinLink(data) };
  }

  const created = await insertReusableInvite(supabase, companyId, user.id, role);
  if (created.error && !/23505/.test(created.error.message)) {
    return { ok: false, error: created.error.message };
  }
  const again = (await readReusableInvites(supabase, companyId)).find(
    (row) => row.role === role,
  );
  if (!again) {
    return { ok: false, error: "Could not create that team join link." };
  }
  return { ok: true, data: toJoinLink(again) };
}
