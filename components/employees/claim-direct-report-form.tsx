"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { claimDirectReport } from "@/lib/actions/employees";
import type { ClaimableTeammate } from "@/lib/actions/employees";

const FIELD =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50";

export function ClaimDirectReportForm({
  teammates,
}: {
  teammates: ClaimableTeammate[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [employeeId, setEmployeeId] = useState(teammates[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!teammates.some((row) => row.id === employeeId)) {
      setEmployeeId(teammates[0]?.id ?? "");
    }
  }, [teammates, employeeId]);

  if (teammates.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-medium text-slate-900">Add from the team</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Everyone at this business already reports to you, or there is nobody
          else on the payroll yet.
        </p>
      </div>
    );
  }

  return (
    <form
      className="rounded-xl border border-slate-200 bg-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setSaved(false);
        start(async () => {
          const result = await claimDirectReport(employeeId);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setSaved(true);
          router.refresh();
        });
      }}
    >
      <h2 className="text-sm font-medium text-slate-900">Add from the team</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Pick someone at this business. You become their line manager for time
        off. If they already report to someone else, they move to you.
      </p>

      <label htmlFor="claimEmployeeId" className="mt-3 block text-sm font-medium text-slate-700">
        Person
      </label>
      <select
        id="claimEmployeeId"
        value={employeeId}
        onChange={(event) => {
          setEmployeeId(event.target.value);
          setSaved(false);
        }}
        disabled={pending}
        className={FIELD}
      >
        {teammates.map((person) => (
          <option key={person.id} value={person.id}>
            {person.fullName}
            {person.jobTitle ? ` · ${person.jobTitle}` : ""}
            {person.managerName
              ? ` · Reports to ${person.managerName}`
              : " · No line manager"}
          </option>
        ))}
      </select>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="mt-2 text-sm text-emerald-700">
          Added. They will show on your team and their time-off requests come to
          you.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !employeeId}
        className="mt-3 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add to my team"}
      </button>
    </form>
  );
}
