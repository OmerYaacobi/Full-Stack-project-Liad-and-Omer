import { StatCard } from "@/components/shared/stat-card";
import type { PayInsights } from "@/lib/domain/insights";
import { volatilityHint, volatilityLabel } from "@/lib/domain/insights";
import type { LeaveBalance } from "@/lib/actions/time-off";
import {
  formatDays,
  formatIls,
  formatPayslipPeriod,
  formatPercent,
  formatSignedIls,
} from "@/lib/format";

export function PayInsightCards({
  insights,
  vacation,
  sick,
}: {
  insights: PayInsights;
  vacation: LeaveBalance | undefined;
  sick: LeaveBalance | undefined;
}) {
  const { latest, previous, deltaAmount, deltaPercent } = insights;
  const delta = monthDelta(deltaAmount, deltaPercent, previous);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <StatCard
        label="Last net paid"
        value={latest ? formatIls(latest.netPay) : "—"}
        delta={delta}
        hint={
          latest
            ? formatPayslipPeriod(latest.year, latest.month)
            : "Your first pay slip will appear here once it is published."
        }
      />
      <StatCard
        label="Average net"
        value={
          insights.rollingAverage !== null
            ? formatIls(insights.rollingAverage)
            : "—"
        }
        hint={
          insights.rollingAverage !== null
            ? `Last ${insights.rollingCount} months`
            : "Needs 3 published months"
        }
      />
      <StatCard
        label="Deduction rate"
        value={
          insights.deductionRate !== null
            ? formatPercent(insights.deductionRate)
            : "—"
        }
        hint={latest ? "Of latest gross — not a tax rate" : "No pay slips yet"}
      />
      <StatCard
        label="Pay pattern"
        value={
          insights.volatilityKind
            ? volatilityLabel(insights.volatilityKind)
            : "—"
        }
        hint={
          insights.volatilityKind
            ? volatilityHint(insights.volatilityKind)
            : "Needs 3 published months"
        }
      />
      <StatCard
        label="Vacation remaining"
        value={vacation ? formatDays(vacation.availableDays) : "—"}
        hint={leaveHint(vacation, "Annual holidays")}
      />
      <StatCard
        label="Sick remaining"
        value={sick ? formatDays(sick.availableDays) : "—"}
        hint={leaveHint(sick, "Sick leave")}
      />
      <StatCard
        label="Taken home this year"
        value={insights.ytdCount > 0 ? formatIls(insights.ytdTotal) : "—"}
        hint={
          insights.ytdCount > 0
            ? insights.ytdAverage !== null
              ? `YTD average ${formatIls(insights.ytdAverage)} · ${insights.ytdCount} months`
              : `${insights.ytdCount} month this year`
            : "No published slips this year"
        }
      />
      <StatCard
        label="Highest / lowest net"
        value={
          insights.maxNet !== null && insights.minNet !== null
            ? `${formatIls(insights.maxNet)} / ${formatIls(insights.minNet)}`
            : "—"
        }
        hint={
          insights.maxNet !== null
            ? "In the last 12 published months"
            : "No pay slips yet"
        }
      />
    </div>
  );
}

function leaveHint(balance: LeaveBalance | undefined, fallbackName: string): string {
  if (!balance) return "No leave days set";
  return `${formatDays(balance.pendingDays)} pending · ${balance.name || fallbackName}`;
}

function monthDelta(
  amount: number | null,
  percent: number | null,
  previous: PayInsights["previous"],
): { label: string; direction: "up" | "down" | "flat" } | undefined {
  if (amount === null || !previous) return undefined;
  const vs = formatPayslipPeriod(previous.year, previous.month);
  if (amount === 0) {
    return { label: `Same as ${vs}`, direction: "flat" };
  }
  const pct =
    percent !== null ? ` (${percent > 0 ? "+" : ""}${formatPercent(percent, 1)})` : "";
  const word = amount > 0 ? "more than" : "less than";
  return {
    label: `${formatSignedIls(amount)} ${word} ${vs}${pct}`,
    direction: amount > 0 ? "up" : "down",
  };
}
