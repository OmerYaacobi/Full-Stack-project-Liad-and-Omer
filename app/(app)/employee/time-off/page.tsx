import type { Metadata } from "next";

import { LeaveBalanceCards } from "@/components/time-off/balance-cards";
import { TimeOffRequestForm } from "@/components/time-off/request-form";
import { TimeOffRequestList } from "@/components/time-off/request-list";
import { PageHeader } from "@/components/shared/page-header";
import {
  listMyLeaveBalances,
  listMyTimeOffRequests,
} from "@/lib/actions/time-off";
import { requireMembership } from "@/lib/auth/context";

export const metadata: Metadata = {
  title: "Time off",
};

export default async function EmployeeTimeOffPage() {
  const ctx = await requireMembership();
  const [balances, requests] = await Promise.all([
    listMyLeaveBalances(ctx.membership.id, ctx.membership.company.id),
    listMyTimeOffRequests(ctx.membership.id),
  ]);

  return (
    <>
      <PageHeader
        title="Time off"
        description="Balances reserve pending days, so two overlapping requests cannot both spend the same leave."
      />

      <LeaveBalanceCards balances={balances} />

      <div className="mt-8">
        <TimeOffRequestForm balances={balances} />
      </div>

      <div className="mt-8 space-y-4">
        <h2 className="text-sm font-medium text-slate-900">Your requests</h2>
        <TimeOffRequestList requests={requests} />
      </div>
    </>
  );
}
