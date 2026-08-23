"use client";

import { setPayslipManagerShare } from "@/lib/actions/payslips";
import { ManagerShareToggle } from "@/components/shared/manager-share-toggle";

export function PayslipShareToggle({
  payslipId,
  shared,
}: {
  payslipId: string;
  shared: boolean;
}) {
  return (
    <ManagerShareToggle
      shared={shared}
      onToggle={(next) => setPayslipManagerShare(payslipId, next)}
    />
  );
}
