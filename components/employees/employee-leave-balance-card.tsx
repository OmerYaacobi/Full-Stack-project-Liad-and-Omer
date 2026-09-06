"use client";

import { useState } from "react";
import { updateEmployeeLeaveBalances } from "@/lib/actions/employees";
import type { LeaveBalance } from "@/lib/actions/time-off";

export function EmployeeLeaveBalanceCard({
  companyId,
  employeeId,
  employeeName,
  balances,
}: {
  companyId: string;
  employeeId: string;
  employeeName: string;
  balances: LeaveBalance[];
}) {
  const vacation = balances.find((b) => b.code === "vacation");
  const sick = balances.find((b) => b.code === "sick");

  const [isEditing, setIsEditing] = useState(false);
  const [vacationInput, setVacationInput] = useState(
    vacation ? String(vacation.availableDays) : "0",
  );
  const [sickInput, setSickInput] = useState(
    sick ? String(sick.availableDays) : "0",
  );

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const vacDays = parseFloat(vacationInput);
    const skDays = parseFloat(sickInput);

    if (isNaN(vacDays) || vacDays < 0) {
      setErrorMessage("Please enter a valid non-negative number for Vacation Days.");
      return;
    }
    if (isNaN(skDays) || skDays < 0) {
      setErrorMessage("Please enter a valid non-negative number for Sick Days.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await updateEmployeeLeaveBalances({
        companyId,
        employeeId,
        vacationDays: vacDays,
        sickDays: skDays,
      });

      if (!res.ok) {
        setErrorMessage(res.error || "Failed to update leave balances.");
      } else {
        setSuccessMessage("Leave balances updated successfully! Approved time-off will now automatically deduct from these amounts.");
        setIsEditing(false);
        setTimeout(() => setSuccessMessage(null), 5000);
      }
    } catch {
      setErrorMessage("An unexpected error occurred while saving.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🏖️</span>
            <h2 className="text-base font-bold text-slate-900">
              Leave &amp; Time-Off Balances
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Set starting balances once. Approved leave requests automatically deduct from these days.
          </p>
        </div>

        {!isEditing && (
          <button
            type="button"
            onClick={() => {
              setVacationInput(vacation ? String(vacation.availableDays) : "0");
              setSickInput(sick ? String(sick.availableDays) : "0");
              setIsEditing(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition cursor-pointer self-start sm:self-auto"
          >
            <span>✏️</span>
            <span>Adjust Balances</span>
          </button>
        )}
      </div>

      {successMessage && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <span>✓</span>
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
          <span>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {isEditing ? (
        <form onSubmit={handleSave} className="space-y-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="vacationInput"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1"
              >
                🏖️ Available Vacation Days (יתרת חופשה)
              </label>
              <input
                id="vacationInput"
                type="number"
                step="0.01"
                min="0"
                max="365"
                required
                value={vacationInput}
                onChange={(e) => setVacationInput(e.target.value)}
                placeholder="e.g. 18.76"
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none transition"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Fractions like 18.76 are supported.
              </p>
            </div>

            <div>
              <label
                htmlFor="sickInput"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1"
              >
                🩺 Available Sick Days (יתרת מחלה)
              </label>
              <input
                id="sickInput"
                type="number"
                step="0.01"
                min="0"
                max="365"
                required
                value={sickInput}
                onChange={(e) => setSickInput(e.target.value)}
                placeholder="e.g. 23.05"
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none transition"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Fractions like 23.05 are supported.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setErrorMessage(null);
              }}
              disabled={isSaving}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              {isSaving ? "Saving..." : "Save Balances"}
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Vacation Days Box */}
          <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                <span>🏖️</span>
                <span>Vacation (חופשה)</span>
              </span>
              <span className="text-lg font-extrabold text-indigo-700">
                {vacation ? vacation.availableDays : 0} days
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-600 pt-2 border-t border-indigo-100/80">
              <span>Used this year: <strong>{vacation ? vacation.usedDays : 0}d</strong></span>
              <span>·</span>
              <span>Pending: <strong>{vacation ? vacation.pendingDays : 0}d</strong></span>
            </div>
          </div>

          {/* Sick Days Box */}
          <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/40">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                <span>🩺</span>
                <span>Sick Leave (מחלה)</span>
              </span>
              <span className="text-lg font-extrabold text-emerald-700">
                {sick ? sick.availableDays : 0} days
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-600 pt-2 border-t border-emerald-100/80">
              <span>Used this year: <strong>{sick ? sick.usedDays : 0}d</strong></span>
              <span>·</span>
              <span>Pending: <strong>{sick ? sick.pendingDays : 0}d</strong></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
