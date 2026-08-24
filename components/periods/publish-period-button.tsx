"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { publishPayrollPeriod } from "@/lib/actions/periods";
import { formatPayslipPeriod } from "@/lib/format";
import type { PeriodStatus } from "@/lib/validations/periods";

export function PublishPeriodButton({
  periodId,
  year,
  month,
  status,
  assignedWaiting,
  employeeCount,
  assignedCount,
}: {
  periodId: string;
  year: number;
  month: number;
  status: PeriodStatus;
  assignedWaiting: number;
  employeeCount: number;
  assignedCount: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (status === "locked" || assignedWaiting === 0) return null;

  const missing = Math.max(0, employeeCount - assignedCount);
  const label = formatPayslipPeriod(year, month);

  function publish() {
    setError(null);
    start(async () => {
      const result = await publishPayrollPeriod(periodId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Publish {assignedWaiting} pay slip{assignedWaiting === 1 ? "" : "s"}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-950">
        Publish {label} to employees?
      </p>
      <p className="mt-1 text-sm text-amber-900">
        This will make {assignedWaiting} pay slip{assignedWaiting === 1 ? "" : "s"}{" "}
        visible. This cannot be undone.
        {missing > 0
          ? ` ${missing} employee${missing === 1 ? "" : "s"} still have no slip for this month.`
          : ""}
      </p>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={publish}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "Publishing…" : "Confirm publish"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
