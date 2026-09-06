"use client";

import { removeDirectReport } from "@/lib/actions/employees";
import { ConfirmDangerButton } from "@/components/shared/confirm-danger-button";

export function RemoveFromTeamButton({
  employeeId,
  fullName,
  redirectTo,
}: {
  employeeId: string;
  fullName: string;
  redirectTo?: string;
}) {
  return (
    <ConfirmDangerButton
      label="Remove from team"
      confirmTitle={`Remove ${fullName} from your team?`}
      confirmBody="They stay at this business. Time-off requests will no longer come to you until they are assigned a new line manager."
      confirmLabel="Remove from team"
      redirectTo={redirectTo}
      onConfirm={() => removeDirectReport(employeeId)}
    />
  );
}
