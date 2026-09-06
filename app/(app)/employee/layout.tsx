import type { ReactNode } from "react";

import { requireRole } from "@/lib/auth/context";

export default async function EmployeeLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole(["employee", "manager"]);
  return <>{children}</>;
}
