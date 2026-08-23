"use client";

import { useState, useTransition } from "react";

import { setEmployeeManager } from "@/lib/actions/employees";
import type { CompanyEmployee } from "@/lib/actions/employees";

const FIELD =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50";

export function AssignManagerForm({
  companyId,
  employee,
  managers,
}: {
  companyId: string;
  employee: CompanyEmployee;
  managers: CompanyEmployee[];
}) {
  const [pending, start] = useTransition();
  const [managerId, setManagerId] = useState(employee.managerId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const options = managers.filter((row) => row.id !== employee.id);

  return (
    <form
      className="rounded-xl border border-slate-200 bg-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setSaved(false);
        start(async () => {
          const result = await setEmployeeManager({
            companyId,
            employeeId: employee.id,
            managerId,
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setSaved(true);
        });
      }}
    >
      <h2 className="text-sm font-medium text-slate-900">Line manager</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Time-off requests go to this person. Leave empty until a manager has
        joined.
      </p>

      <label htmlFor="managerId" className="mt-3 block text-sm font-medium text-slate-700">
        Reports to
      </label>
      <select
        id="managerId"
        value={managerId}
        onChange={(event) => {
          setManagerId(event.target.value);
          setSaved(false);
        }}
        disabled={pending || options.length === 0}
        className={FIELD}
      >
        <option value="">No line manager yet</option>
        {options.map((manager) => (
          <option key={manager.id} value={manager.id}>
            {manager.fullName}
          </option>
        ))}
      </select>

      {options.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">
          Invite a manager to this business first, then assign them here.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="mt-2 text-sm text-emerald-700">
          Saved. Their manager will see their time-off requests.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || options.length === 0}
        className="mt-3 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save manager"}
      </button>
    </form>
  );
}
