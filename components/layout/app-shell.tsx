import type { ReactNode } from "react";
import Link from "next/link";

import { navGroupsFor } from "@/components/layout/nav-items";
import { RoleBadge } from "@/components/layout/role-badge";
import { SideNav } from "@/components/layout/side-nav";
import type { Profile, Workspace } from "@/types/app";

export function AppShell({
  workspace,
  profile,
  email,
  impersonating = false,
  children,
}: {
  workspace: Workspace;
  profile: Profile | null;
  email: string;
  /** Signed in through DEV_AUTH_ROLE rather than a real session. */
  impersonating?: boolean;
  children: ReactNode;
}) {
  const homeHref =
    workspace.role === "bookkeeper"
      ? "/bookkeeper"
      : workspace.role === "manager"
        ? "/manager"
        : "/employee";

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-20 shadow-2xs">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link
            href={homeHref}
            className="flex items-center gap-2.5 font-bold text-slate-900 text-sm sm:text-base hover:opacity-90 transition group"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-600 to-indigo-500 text-white flex items-center justify-center font-extrabold text-sm shadow-sm shadow-indigo-600/30 group-hover:scale-105 transition-transform">
              ₪
            </div>
            <span className="tracking-tight">
              Payroll<span className="text-indigo-600 font-extrabold">Portal</span>
            </span>
          </Link>
          <span className="text-slate-300" aria-hidden="true">
            /
          </span>
          <span className="text-sm font-medium text-slate-600">{workspace.name}</span>

          <div className="ms-auto flex items-center gap-3">
            {impersonating && (
              <span
                title="DEV_AUTH_ROLE is set, so this session is faked and no data is being read from Supabase."
                className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-800"
              >
                Dev session
              </span>
            )}
            <RoleBadge role={workspace.role} />
            <span className="hidden text-sm text-slate-500 sm:inline">
              {profile?.fullName || email}
            </span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 md:flex-row">
        <aside className="md:w-56 md:shrink-0">
          <SideNav groups={navGroupsFor(workspace.role)} />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
