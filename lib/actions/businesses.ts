"use server";

import { revalidatePath } from "next/cache";

import { fail, fromZod, ok, type ActionResult } from "@/lib/actions/result";
import { createClient } from "@/lib/supabase/server";
import {
  createBusinessSchema,
  type CreateBusinessInput,
} from "@/lib/validations/auth";
import { z } from "zod";

async function resolveUserFirm(supabase: any, user: any) {
  // 1. Try finding active firm membership
  const { data: firmMembership } = await supabase
    .from("firm_memberships")
    .select(`
      firm_id,
      role,
      bookkeeping_firms (
        id,
        name,
        tax_id,
        created_at
      )
    `)
    .eq("profile_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (firmMembership?.firm_id && firmMembership?.bookkeeping_firms) {
    const firm = Array.isArray(firmMembership.bookkeeping_firms)
      ? firmMembership.bookkeeping_firms[0]
      : firmMembership.bookkeeping_firms;
    return { firmId: firmMembership.firm_id, firm };
  }

  // Only bookkeeper signups carry a firm. Inventing one for an employee would
  // drop them on the firm dashboard the next time they hit /dashboard.
  const meta = user.user_metadata || {};
  if (meta.signup_type !== "bookkeeper") return null;

  const firmName = meta.firm_name || "My Bookkeeping Firm";
  const taxId = meta.tax_id || `FIRMTID-${user.id.slice(0, 8)}`;

  const { data: newFirm } = await supabase
    .from("bookkeeping_firms")
    .upsert({ name: firmName, tax_id: taxId }, { onConflict: "tax_id" })
    .select("id, name, tax_id, created_at")
    .single();

  if (newFirm?.id) {
    await supabase.from("firm_memberships").upsert(
      {
        firm_id: newFirm.id,
        profile_id: user.id,
        role: "bookkeeper",
        is_active: true,
      },
      { onConflict: "firm_id,profile_id" }
    );

    return { firmId: newFirm.id, firm: newFirm };
  }

  return null;
}

export async function getFirmProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Unauthorized" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", user.id)
    .single();

  const resolved = await resolveUserFirm(supabase, user);
  if (!resolved) {
    return {
      ok: false,
      error: "No active bookkeeping firm found for this user account.",
    };
  }

  return {
    ok: true,
    data: {
      profile,
      firm: {
        id: resolved.firm.id,
        name: resolved.firm.name || "Bookkeeping Firm",
        taxId: resolved.firm.tax_id || "",
        createdAt: resolved.firm.created_at,
      },
    },
  };
}

export async function createBusiness(input: CreateBusinessInput) {
  const parsed = createBusinessSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message || "Validation failed",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Unauthorized" };
  }

  // Resolve firm ID
  const resolved = await resolveUserFirm(supabase, user);
  if (!resolved?.firmId) {
    return {
      ok: false,
      error: "Only registered bookkeeping firms can create client businesses.",
    };
  }

  // Insert the new business under this firm
  const { data: company, error: insertError } = await supabase
    .from("companies")
    .insert({
      firm_id: resolved.firmId,
      name: parsed.data.name,
      tax_id: parsed.data.taxId,
      timezone: parsed.data.timezone,
      currency: parsed.data.currency,
      managers_can_view_payslip_files: parsed.data.managersCanViewPayslipFiles,
    })
    .select("id, name, tax_id, created_at")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return {
        ok: false,
        error: "A business with this Tax ID already exists under your firm.",
      };
    }
    return { ok: false, error: insertError.message };
  }

  // Provision default leave types for the new business
  await supabase.from("leave_types").insert([
    {
      company_id: company.id,
      code: "vacation",
      name: "Annual Vacation",
      accrual_days_per_month: 1.0,
      is_paid: true,
    },
    {
      company_id: company.id,
      code: "sick",
      name: "Sick Leave",
      accrual_days_per_month: 1.5,
      is_paid: true,
    },
    {
      company_id: company.id,
      code: "reserve_duty",
      name: "Reserve Duty",
      accrual_days_per_month: 0,
      is_paid: true,
    },
  ]);

  return { ok: true, data: company };
}

export async function listFirmBusinesses() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Unauthorized", data: [] };
  }

  // Resolve current firm ID
  const resolved = await resolveUserFirm(supabase, user);
  if (!resolved?.firmId) {
    return { ok: true, data: [] };
  }

  // Strictly filter businesses by this firm's ID
  const { data: companies, error } = await supabase
    .from("companies")
    .select(`
      id,
      name,
      tax_id,
      timezone,
      currency,
      created_at,
      employees (count),
      invitations (id, used_at, expires_at)
    `)
    .eq("firm_id", resolved.firmId)
    .order("created_at", { ascending: false });

  if (error) {
    return { ok: false, error: error.message, data: [] };
  }

  const now = new Date();
  const formatted = (companies || []).map((c: any) => {
    // Count only pending invitations (not yet accepted and not expired)
    const pendingInvitesCount = (c.invitations || []).filter(
      (inv: any) => !inv.used_at && new Date(inv.expires_at) > now
    ).length;

    return {
      id: c.id,
      name: c.name,
      taxId: c.tax_id,
      timezone: c.timezone,
      currency: c.currency,
      createdAt: c.created_at,
      employeeCount: c.employees?.[0]?.count || 0,
      invitationCount: pendingInvitesCount,
    };
  });

  return { ok: true, data: formatted };
}

export async function removeCompany(
  companyId: string,
): Promise<ActionResult<void>> {
  const parsed = z.object({ companyId: z.string().uuid() }).safeParse({
    companyId,
  });
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const [{ data: slips }, { data: documents }, { data: attachments }] =
    await Promise.all([
      supabase.from("payslips").select("file_path").eq("company_id", parsed.data.companyId),
      supabase.from("documents").select("file_path").eq("company_id", parsed.data.companyId),
      supabase
        .from("time_off_attachments")
        .select("file_path")
        .eq("company_id", parsed.data.companyId),
    ]);

  const { error } = await supabase.rpc("remove_company", {
    p_company_id: parsed.data.companyId,
  });
  if (error) {
    if (/NOT_BOOKKEEPER/i.test(error.message) || error.code === "42501") {
      return fail("FORBIDDEN", "You do not have permission to remove this business.");
    }
    if (/COMPANY_NOT_FOUND/i.test(error.message) || error.code === "P0002") {
      return fail("NOT_FOUND", "That business is no longer available.");
    }
    return fail("INTERNAL", "Could not remove that business. Try again.");
  }

  const payslipPaths = (slips ?? [])
    .map((row) => row.file_path)
    .filter((path): path is string => Boolean(path));
  const documentPaths = (documents ?? [])
    .map((row) => row.file_path)
    .filter((path): path is string => Boolean(path));
  const timeOffPaths = (attachments ?? [])
    .map((row) => row.file_path)
    .filter((path): path is string => Boolean(path));

  if (payslipPaths.length) {
    await supabase.storage.from("payslips").remove(payslipPaths);
  }
  if (documentPaths.length) {
    await supabase.storage.from("documents").remove(documentPaths);
  }
  if (timeOffPaths.length) {
    await supabase.storage.from("time_off").remove(timeOffPaths);
  }

  revalidatePath("/bookkeeper");
  revalidatePath("/bookkeeper/businesses");
  revalidatePath("/bookkeeper/periods");
  revalidatePath("/dashboard");
  return ok(undefined);
}
