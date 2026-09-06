import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { TeamCalendar } from "@/components/time-off/team-calendar";
import { listManagerCalendar } from "@/lib/actions/time-off";
import { requireMembership } from "@/lib/auth/context";
import { formatMonthKey, shiftMonth } from "@/lib/domain/working-days";

export const metadata: Metadata = {
  title: "Calendar",
};

export default async function ManagerCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const ctx = await requireMembership();
  const calendar = await listManagerCalendar(
    ctx.membership.company.id,
    monthParam,
  );
  const prev = shiftMonth(calendar.year, calendar.month, -1);
  const next = shiftMonth(calendar.year, calendar.month, 1);

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Days people at this business are away. Click a day to see who is off and why."
      />
      <TeamCalendar
        key={formatMonthKey(calendar.year, calendar.month)}
        year={calendar.year}
        month={calendar.month}
        today={calendar.today}
        weekendDays={calendar.weekendDays}
        absences={calendar.absences}
        prevHref={`/manager/calendar?month=${formatMonthKey(prev.year, prev.month)}`}
        nextHref={`/manager/calendar?month=${formatMonthKey(next.year, next.month)}`}
      />
    </>
  );
}
