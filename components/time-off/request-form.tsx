"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import {
  previewTimeOff,
  submitTimeOffRequest,
  type LeaveBalance,
  type TimeOffPreview,
} from "@/lib/actions/time-off";
import { formatDays } from "@/lib/format";

const FIELD =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50";

export function TimeOffRequestForm({
  balances,
}: {
  balances: LeaveBalance[];
}) {
  const [state, submit, pending] = useActionState(submitTimeOffRequest, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [leaveTypeId, setLeaveTypeId] = useState(balances[0]?.leaveTypeId ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [useRemaining, setUseRemaining] = useState(false);
  const [preview, setPreview] = useState<TimeOffPreview | null>(null);

  const selected = balances.find((row) => row.leaveTypeId === leaveTypeId);
  const canUseRemaining =
    Boolean(selected?.tracksBalance) && (selected?.availableDays ?? 0) > 0;
  const remainingDays = selected?.availableDays ?? 0;
  const insufficient =
    !useRemaining &&
    Boolean(preview) &&
    Boolean(selected?.tracksBalance) &&
    preview !== null &&
    preview.workingDays > 0 &&
    preview.remainingDays !== null &&
    preview.remainingDays < 0;

  const failed = state?.ok === false;
  const fieldErrors = failed ? state.fieldErrors : undefined;
  const formError = failed && !fieldErrors ? state.error : undefined;

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setStartDate("");
      setEndDate("");
      setUseRemaining(false);
      setPreview(null);
    }
  }, [state]);

  useEffect(() => {
    if (!canUseRemaining && useRemaining) setUseRemaining(false);
  }, [canUseRemaining, useRemaining]);

  useEffect(() => {
    if (useRemaining || !leaveTypeId || !startDate || !endDate || endDate < startDate) {
      setPreview(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void previewTimeOff({ leaveTypeId, startDate, endDate }).then((result) => {
        if (!cancelled && result.ok) setPreview(result.data);
        if (!cancelled && !result.ok) setPreview(null);
      });
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [leaveTypeId, startDate, endDate, useRemaining]);

  const previewText = useMemo(() => {
    if (useRemaining && selected?.tracksBalance) {
      return `This uses all ${formatDays(remainingDays)} remaining, including leftover half-days. You will have 0 days left.`;
    }
    if (!preview) return null;
    if (preview.workingDays === 0) {
      return "Those dates contain no working days (weekends or holidays).";
    }
    const calendar = `${preview.calendarDays} calendar ${preview.calendarDays === 1 ? "day" : "days"} = ${formatDays(preview.workingDays)}`;
    if (!preview.tracksBalance || preview.remainingDays === null) {
      return calendar;
    }
    if (preview.remainingDays < 0) {
      return `${calendar}. You only have ${formatDays(preview.availableDays ?? 0)} available.`;
    }
    return `${calendar}. You will have ${formatDays(preview.remainingDays)} remaining.`;
  }, [preview, remainingDays, selected?.tracksBalance, useRemaining]);

  if (balances.length === 0) return null;

  return (
    <form
      ref={formRef}
      action={submit}
      className="rounded-xl border border-slate-200 bg-white p-4"
    >
      <h2 className="text-sm font-medium text-slate-900">Request time off</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Working days are counted from this business&apos;s weekends and holidays.
        Pending requests already reserve the days.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="leaveTypeId" className="block text-sm font-medium text-slate-700">
            Leave type
          </label>
          <select
            id="leaveTypeId"
            name="leaveTypeId"
            value={leaveTypeId}
            onChange={(event) => setLeaveTypeId(event.target.value)}
            disabled={pending}
            className={FIELD}
          >
            {balances.map((balance) => (
              <option key={balance.leaveTypeId} value={balance.leaveTypeId}>
                {balance.name}
                {balance.tracksBalance
                  ? ` · ${formatDays(balance.availableDays)} left`
                  : ""}
              </option>
            ))}
          </select>
          <FieldError messages={fieldErrors?.leaveTypeId} />
        </div>

        {canUseRemaining ? (
          <label className="sm:col-span-2 flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              name="useRemaining"
              value="on"
              checked={useRemaining}
              onChange={(event) => setUseRemaining(event.target.checked)}
              disabled={pending}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium text-slate-900">
                Use all remaining {selected?.name.toLowerCase() ?? "leave"}
                {" · "}
                {formatDays(remainingDays)}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Spends the full remaining balance, including leftover half-days.
                No dates needed.
              </span>
            </span>
          </label>
        ) : null}

        {!useRemaining ? (
          <>
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-slate-700">
                From
              </label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                required
                value={startDate}
                onChange={(event) => {
                  const next = event.target.value;
                  setStartDate(next);
                  if (endDate && endDate < next) setEndDate(next);
                }}
                disabled={pending}
                className={FIELD}
              />
              <FieldError messages={fieldErrors?.startDate} />
            </div>

            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-slate-700">
                Through
              </label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                required
                value={endDate}
                min={startDate || undefined}
                onChange={(event) => setEndDate(event.target.value)}
                disabled={pending}
                className={FIELD}
              />
              <FieldError messages={fieldErrors?.endDate} />
            </div>
          </>
        ) : null}

        <div className="sm:col-span-2">
          <label htmlFor="reason" className="block text-sm font-medium text-slate-700">
            Reason <span className="text-slate-400">(optional)</span>
          </label>
          <textarea
            id="reason"
            name="reason"
            rows={2}
            maxLength={500}
            disabled={pending}
            className={FIELD}
          />
          <FieldError messages={fieldErrors?.reason} />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="attachments" className="block text-sm font-medium text-slate-700">
            Files <span className="text-slate-400">(optional)</span>
          </label>
          <input
            id="attachments"
            name="attachments"
            type="file"
            multiple
            accept="application/pdf,image/png,image/jpeg"
            disabled={pending}
            className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800 disabled:opacity-60"
          />
          <p className="mt-1 text-xs text-slate-500">
            PDF, PNG, or JPEG — up to 5 files, 10 MB each. A doctor&apos;s note
            or travel confirmation helps your manager decide.
          </p>
          <FieldError messages={fieldErrors?.attachments} />
        </div>
      </div>

      {previewText && (
        <div
          className={`mt-4 p-3.5 rounded-xl border text-xs sm:text-sm flex items-start gap-2.5 transition-all shadow-2xs ${
            insufficient
              ? "border-red-200 bg-red-50/80 text-red-800"
              : preview?.workingDays === 0
                ? "border-amber-200 bg-amber-50/80 text-amber-800"
                : "border-indigo-200 bg-indigo-50/60 text-indigo-900"
          }`}
        >
          <span className="text-base shrink-0">
            {insufficient ? "⚠️" : preview?.workingDays === 0 ? "ℹ️" : "✨"}
          </span>
          <div className="flex-1 font-medium leading-relaxed">{previewText}</div>
        </div>
      )}

      {formError && (
        <div role="alert" className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs sm:text-sm text-red-700 flex items-center gap-2">
          <span>⚠️</span>
          <span>{formError}</span>
        </div>
      )}
      {state?.ok && (
        <div role="status" className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-800 flex items-center gap-2">
          <span>✓</span>
          <span>Request sent successfully! It stays pending until a manager or bookkeeper approves.</span>
        </div>
      )}

      <button
        type="submit"
        disabled={
          pending ||
          insufficient ||
          (!useRemaining && preview?.workingDays === 0) ||
          (useRemaining && remainingDays <= 0)
        }
        className="mt-5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
      >
        {pending ? (
          <span>Sending Request...</span>
        ) : useRemaining ? (
          <span>Request All Remaining Days →</span>
        ) : (
          <span>Submit Time-Off Request →</span>
        )}
      </button>
    </form>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-sm text-red-600">{messages[0]}</p>;
}
