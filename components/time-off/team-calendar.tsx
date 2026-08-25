"use client";

import { useState } from "react";
import Link from "next/link";

import type { CalendarAbsence } from "@/lib/actions/time-off";
import { formatDateRange, formatIsoDate, formatPayslipPeriod } from "@/lib/format";
import { RequestStatusBadge } from "@/components/time-off/status-badge";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function TeamCalendar({
  year,
  month,
  today,
  weekendDays,
  absences,
  prevHref,
  nextHref,
}: {
  year: number;
  month: number;
  today: string;
  weekendDays: number[];
  absences: CalendarAbsence[];
  prevHref: string;
  nextHref: string;
}) {
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const defaultSelected = today.startsWith(`${monthKey}-`) ? today : null;
  const [selected, setSelected] = useState<string | null>(defaultSelected);

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingBlanks = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const selectedAbsences = selected
    ? absencesOn(absences, selected)
    : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="min-w-0">
        <div className="mb-3 flex items-center justify-between gap-3">
          <Link
            href={prevHref}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Previous
          </Link>
          <h2 className="text-sm font-medium text-slate-900">
            {formatPayslipPeriod(year, month)}
          </h2>
          <Link
            href={nextHref}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Next
          </Link>
        </div>

        <div className="flex flex-wrap gap-4 pb-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Approved — off work
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            Pending — requested
          </span>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-center text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {WEEKDAYS.map((label) => (
              <div key={label} className="px-1 py-2">
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: leadingBlanks }, (_, index) => (
              <div
                key={`blank-${index}`}
                className="min-h-16 border-b border-r border-slate-100 bg-slate-50 sm:min-h-[5.5rem] [&:nth-child(7n)]:border-r-0"
              />
            ))}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1;
              const iso = `${monthKey}-${String(day).padStart(2, "0")}`;
              const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
              const onDay = absencesOn(absences, iso);
              const hasApproved = onDay.some((row) => row.status === "approved");
              const hasPending = onDay.some((row) => row.status === "pending");
              const isToday = iso === today;
              const isSelected = iso === selected;
              const isWeekend = weekendDays.includes(weekday);

              const bg = hasApproved
                ? "bg-emerald-50 hover:bg-emerald-100"
                : hasPending
                  ? "bg-amber-50 hover:bg-amber-100"
                  : isWeekend
                    ? "bg-slate-50 hover:bg-slate-100"
                    : "bg-white hover:bg-slate-50";

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelected(iso)}
                  aria-pressed={isSelected}
                  aria-label={dayLabel(iso, onDay)}
                  className={[
                    "flex min-h-16 flex-col items-start gap-1 border-b border-r border-slate-100 p-1.5 text-left sm:min-h-[5.5rem] [&:nth-child(7n)]:border-r-0",
                    bg,
                    isSelected ? "ring-2 ring-inset ring-slate-900" : "",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                      isToday
                        ? "bg-slate-900 text-white"
                        : isWeekend
                          ? "text-slate-400"
                          : "text-slate-700",
                    ].join(" ")}
                  >
                    {day}
                  </span>
                  {onDay.length > 0 ? (
                    <span className="hidden w-full space-y-0.5 sm:block">
                      {onDay.slice(0, 2).map((row) => (
                        <span
                          key={row.id}
                          className={`block truncate text-[11px] leading-tight ${
                            row.status === "approved"
                              ? "text-emerald-800"
                              : "text-amber-800"
                          }`}
                        >
                          {firstName(row.employeeName)}
                        </span>
                      ))}
                      {onDay.length > 2 ? (
                        <span className="block text-[11px] text-slate-500">
                          +{onDay.length - 2} more
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                  {onDay.length > 0 ? (
                    <span className="mt-auto flex flex-wrap gap-0.5 sm:hidden">
                      {onDay.slice(0, 4).map((row) => (
                        <span
                          key={row.id}
                          className={`h-1.5 w-1.5 rounded-full ${
                            row.status === "approved"
                              ? "bg-emerald-500"
                              : "bg-amber-400"
                          }`}
                        />
                      ))}
                    </span>
                  ) : null}
                </button>
              );
            })}
            {Array.from(
              { length: (7 - ((leadingBlanks + daysInMonth) % 7)) % 7 },
              (_, index) => (
                <div
                  key={`trail-${index}`}
                  className="min-h-16 border-b border-r border-slate-100 bg-slate-50 sm:min-h-[5.5rem] [&:nth-child(7n)]:border-r-0"
                />
              ),
            )}
          </div>
        </div>
      </section>

      <aside className="rounded-xl border border-slate-200 bg-white p-4 lg:self-start">
        {selected ? (
          <>
            <h2 className="text-sm font-medium text-slate-900">
              {formatIsoDate(selected)}
            </h2>
            {selectedAbsences.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                Nobody is off on this day.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {selectedAbsences.map((row) => (
                  <li key={row.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">
                        {row.employeeName}
                      </p>
                      <RequestStatusBadge status={row.status} />
                    </div>
                    <p className="mt-1 text-sm text-slate-700">
                      {row.leaveTypeName}
                      {row.reason ? ` — ${row.reason}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatDateRange(row.startDate, row.endDate)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <h2 className="text-sm font-medium text-slate-900">Pick a day</h2>
            <p className="mt-2 text-sm text-slate-500">
              Click a marked day to see who is away and why they requested it.
            </p>
          </>
        )}
      </aside>
    </div>
  );
}

function absencesOn(absences: CalendarAbsence[], iso: string): CalendarAbsence[] {
  return absences
    .filter((row) => row.startDate <= iso && iso <= row.endDate)
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function dayLabel(iso: string, onDay: CalendarAbsence[]): string {
  const date = formatIsoDate(iso);
  if (onDay.length === 0) return `${date}, nobody off`;
  const names = onDay.map((row) => row.employeeName).join(", ");
  return `${date}, ${names}`;
}
