import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { requireWorkspace } from "@/lib/auth/context";
import { devAuthRole } from "@/lib/auth/dev-auth";

/**
 * Resolves identity once per request and hands it to the shell, so no page
 * below repeats the auth round trip.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await requireWorkspace();

  return (
    <AppShell
      workspace={ctx.workspace}
      profile={ctx.profile}
      email={ctx.email}
      impersonating={devAuthRole() !== null}
    >
      {children}
    </AppShell>
  );
}
