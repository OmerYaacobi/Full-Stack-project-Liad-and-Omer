"use client";

import { removeCompany } from "@/lib/actions/businesses";
import { ConfirmDangerButton } from "@/components/shared/confirm-danger-button";

export function RemoveCompanyButton({
  companyId,
  companyName,
  redirectTo = "/bookkeeper/businesses",
  onSuccess,
}: {
  companyId: string;
  companyName: string;
  redirectTo?: string;
  onSuccess?: () => void;
}) {
  return (
    <ConfirmDangerButton
      label="Remove business"
      confirmTitle={`Remove ${companyName}?`}
      confirmBody="This deletes the business, its people, pay slips, and files. This cannot be undone."
      confirmLabel="Remove business"
      requireText={companyName}
      requireLabel={`Type the business name (${companyName}) to confirm`}
      redirectTo={redirectTo}
      onSuccess={onSuccess}
      onConfirm={() => removeCompany(companyId)}
    />
  );
}
