"use client";

const FIELD =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50";

export function PayslipLeaveFields({
  vacationDays,
  sickDays,
  onVacationChange,
  onSickChange,
  disabled,
  compact = false,
}: {
  vacationDays: string;
  sickDays: string;
  onVacationChange: (value: string) => void;
  onSickChange: (value: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const labelClass = compact
    ? "block text-xs font-semibold text-slate-700 mb-1"
    : "block text-sm font-medium text-slate-700";

  return (
    <>
      <div>
        <label htmlFor="vacationDays" className={labelClass}>
          יתרת חופשה
        </label>
        <input
          id="vacationDays"
          name="vacationDays"
          type="number"
          inputMode="decimal"
          min={0}
          max={365}
          step="0.01"
          placeholder="e.g. 3.44"
          value={vacationDays}
          onChange={(event) => onVacationChange(event.target.value)}
          disabled={disabled}
          className={FIELD}
        />
        <p className="mt-1 text-xs text-slate-500">
          Vacation remaining (חופש). Fractions like 3.44 are valid. Leave blank if the slip has no leave box.
        </p>
      </div>
      <div>
        <label htmlFor="sickDays" className={labelClass}>
          יתרת מחלה
        </label>
        <input
          id="sickDays"
          name="sickDays"
          type="number"
          inputMode="decimal"
          min={0}
          max={365}
          step="0.01"
          placeholder="e.g. 8.00"
          value={sickDays}
          onChange={(event) => onSickChange(event.target.value)}
          disabled={disabled}
          className={FIELD}
        />
        <p className="mt-1 text-xs text-slate-500">
          Sick remaining (מחלה). Separate from vacation. Updates their balance when you publish.
        </p>
      </div>
    </>
  );
}
