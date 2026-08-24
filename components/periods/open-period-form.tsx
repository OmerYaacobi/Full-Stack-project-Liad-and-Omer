"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { openPayrollPeriod } from "@/lib/actions/periods";
import { MONTHS } from "@/lib/validations/payslips";

const FIELD =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900";

function defaultPeriod() {
  const last = new Date();
  last.setDate(1);
  last.setMonth(last.getMonth() - 1);
  return { year: last.getFullYear(), month: last.getMonth() + 1 };
}

export function OpenPeriodForm({
  businesses,
  defaultCompanyId,
}: {
  businesses: { id: string; name: string }[];
  defaultCompanyId?: string;
}) {
  const router = useRouter();
  const period = defaultPeriod();
  const [state, submit, pending] = useActionState(openPayrollPeriod, null);
  const [month, setMonth] = useState(period.month);
  const [year, setYear] = useState(period.year);

  useEffect(() => {
    if (state?.ok) {
      router.push(`/bookkeeper/periods/${state.data.periodId}`);
    }
  }, [state, router]);

  const failed = state?.ok === false;

  return (
    <form
      action={submit}
      className="rounded-xl border border-slate-200 bg-white p-4"
    >
      <h2 className="text-sm font-medium text-slate-900">Open a payroll month</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Creates a draft if this month does not exist yet, or opens the one you already have.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="block text-sm font-medium text-slate-700 sm:col-span-1">
          Business
          <select
            name="companyId"
            required
            defaultValue={defaultCompanyId ?? businesses[0]?.id ?? ""}
            className={FIELD}
            disabled={pending || businesses.length === 0}
          >
            {businesses.length === 0 ? (
              <option value="">No businesses yet</option>
            ) : (
              businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))
            )}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Month
          <select
            name="month"
            value={month}
            onChange={(event) => setMonth(Number(event.target.value))}
            className={FIELD}
            disabled={pending}
          >
            {MONTHS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Year
          <input
            name="year"
            type="number"
            min={2000}
            max={2100}
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className={FIELD}
            disabled={pending}
            required
          />
        </label>
      </div>

      {failed ? (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || businesses.length === 0}
        className="mt-4 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-300"
      >
        {pending ? "Opening…" : "Open month"}
      </button>
    </form>
  );
}
