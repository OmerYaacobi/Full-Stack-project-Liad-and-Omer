import type { Metadata } from "next";

import { PayslipList } from "@/components/payslips/payslip-list";
import { PageHeader } from "@/components/shared/page-header";
import { listMyPayslips } from "@/lib/actions/payslips";
import { requireMembership } from "@/lib/auth/context";

export const metadata: Metadata = {
  title: "Pay slips",
};

export default async function EmployeePayslipsPage() {
  const ctx = await requireMembership();
  const payslips = await listMyPayslips(
    ctx.membership.id,
    ctx.membership.company.id,
  );

  return (
    <>
      <PageHeader
        title="Pay slips"
        description="Published months only. Drafts stay with your bookkeeper until they publish."
      />
      <PayslipList
        payslips={payslips}
        emptyTitle="No pay slips yet"
        emptyDescription="Your first pay slip will appear here once your bookkeeper publishes it."
      />
    </>
  );
}
