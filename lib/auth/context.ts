import { cache } from "react";
import { redirect } from "next/navigation";

import { devAuthRole, devContext } from "@/lib/auth/dev-auth";
import { createClient } from "@/lib/supabase/server";
import type {
  ActiveMembership,
  AppRole,
  AuthContext,
  Firm,
  Profile,
  Workspace,
} from "@/types/app";

// Postgres "relation does not exist". The membership tables are still being
// built, so until the first migration lands a signed-in user simply has no
// membership rather than the whole app failing to render.
const UNDEFINED_TABLE = "42P01";

export function roleHome(role: AppRole): string {
  switch (role) {
    case "employee":
      return "/employee";
    case "manager":
      return "/manager";
    case "bookkeeper":
      return "/bookkeeper";
  }
}

/**
 * Resolves the signed-in user, their profile, and their active memberships.
 *
 * Wrapped in React's `cache` so several layouts calling it during one render
 * share a single round trip. Returns null when nobody is signed in.
 */
export function homeFor(ctx: AuthContext): string {
  const workspace = workspaceOf(ctx);
  return workspace ? roleHome(workspace.role) : "/no-access";
}

export const getContext = cache(async (): Promise<AuthContext | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A real session always wins. DEV_AUTH_ROLE is only a stand-in for when
  // nobody is signed in, so logging in as an employee is not overwritten by
  // a leftover bookkeeper impersonation.
  if (!user) {
    const devRole = devAuthRole();
    return devRole ? devContext(devRole) : null;
  }

  const [profile, memberships, firm] = await Promise.all([
    loadProfile(supabase, user.id),
    loadMemberships(supabase, user.id),
    loadFirm(supabase, user.id),
  ]);

  return {
    userId: user.id,
    email: user.email ?? profile?.email ?? "",
    profile,
    memberships,
    membership:
      memberships.find((row) => row.role !== "bookkeeper") ??
      memberships[0] ??
      null,
    firm,
  };
});

export async function requireContext(): Promise<AuthContext> {
  const ctx = await getContext();
  if (!ctx) redirect("/login");
  return ctx;
}

export async function requireMembership(): Promise<
  AuthContext & { membership: ActiveMembership }
> {
  const ctx = await requireContext();
  if (!ctx.membership) redirect("/no-access");
  return { ...ctx, membership: ctx.membership };
}

/**
 * Derives the workspace a signed-in user is looking at. A company membership
 * wins when there is one; otherwise a firm membership admits a bookkeeper who
 * manages client companies without being an employee of any of them.
 */
export function workspaceOf(ctx: AuthContext): Workspace | null {
  if (ctx.membership) {
    return {
      role: ctx.membership.role,
      name: ctx.membership.company.name,
      companyId: ctx.membership.company.id,
    };
  }
  if (ctx.firm) {
    return { role: "bookkeeper", name: ctx.firm.name, companyId: null };
  }
  return null;
}

export async function requireWorkspace(): Promise<
  AuthContext & { workspace: Workspace }
> {
  const ctx = await requireContext();
  const workspace = workspaceOf(ctx);
  if (!workspace) redirect("/no-access");
  return { ...ctx, workspace };
}

/**
 * Layout-level guard. Redirects rather than throwing, because a user landing on
 * a page their role cannot see is a navigation mistake, not an error worth an
 * error boundary. Authorization itself is enforced by RLS; this is UX.
 */
export async function requireRole(
  roles: AppRole[],
): Promise<AuthContext & { workspace: Workspace }> {
  const ctx = await requireWorkspace();
  if (!roles.includes(ctx.workspace.role)) {
    redirect(roleHome(ctx.workspace.role));
  }
  return ctx;
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function loadProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, locale")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    if (error.code === UNDEFINED_TABLE) return null;
    throw error;
  }
  if (!data) return null;

  return {
    id: data.id,
    fullName: data.full_name,
    email: data.email,
    locale: data.locale,
  };
}

async function loadFirm(
  supabase: SupabaseClient,
  userId: string,
): Promise<Firm | null> {
  const { data, error } = await supabase
    .from("firm_memberships")
    .select("bookkeeping_firms(id, name)")
    .eq("profile_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code === UNDEFINED_TABLE) return null;
    throw error;
  }
  if (!data) return null;

  const firm = Array.isArray(data.bookkeeping_firms)
    ? data.bookkeeping_firms[0]
    : data.bookkeeping_firms;

  return firm ? { id: firm.id, name: firm.name } : null;
}

async function loadMemberships(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActiveMembership[]> {
  const { data, error } = await supabase
    .from("memberships")
    .select("id, role, companies(id, name)")
    .eq("profile_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    if (error.code === UNDEFINED_TABLE) return [];
    throw error;
  }

  return (data ?? []).flatMap((row): ActiveMembership[] => {
    const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
    if (!company) return [];
    return [
      {
        id: row.id,
        role: row.role as AppRole,
        company: { id: company.id, name: company.name },
      },
    ];
  });
}
