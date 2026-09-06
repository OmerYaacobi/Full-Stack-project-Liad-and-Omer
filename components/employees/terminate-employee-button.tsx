"use client";

import { terminateEmployee } from "@/lib/actions/employees";
import { ConfirmDangerButton } from "@/components/shared/confirm-danger-button";

export function TerminateEmployeeButton({
  employeeId,
  fullName,
  role,
  redirectTo,
}: {
  employeeId: string;
  fullName: string;
  role: "employee" | "manager" | null;
  redirectTo?: string;
}) {
  const noun = role === "manager" ? "manager" : "employee";
  return (
    <ConfirmDangerButton
      label={`Remove ${noun}`}
      confirmTitle={`Remove ${fullName} from this payroll?`}
      confirmBody={`They will lose access immediately. Pay slips and files stay on the business for history. If they manage anyone, those people will have no line manager.`}
      confirmLabel={`Remove ${noun}`}
      redirectTo={redirectTo}
      onConfirm={() => terminateEmployee(employeeId)}
    />
  );
}
