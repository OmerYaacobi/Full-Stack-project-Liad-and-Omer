/**
 * Leave is counted in working days, from company weekends and holidays.
 * Dates are YYYY-MM-DD strings so a timezone cannot shift the calendar day.
 */

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const asUtc = new Date(Date.UTC(year, month - 1, day));
  return (
    asUtc.getUTCFullYear() === year &&
    asUtc.getUTCMonth() === month - 1 &&
    asUtc.getUTCDate() === day
  );
}

/** Today's calendar date in a named zone, e.g. Asia/Jerusalem. */
export function calendarDateInZone(
  timeZone: string,
  instant = new Date(),
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Postgres `date - date`: whole days from start to end, not counting inclusively. */
export function calendarSpanDays(start: string, end: string): number {
  return Math.floor(
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
      86_400_000,
  );
}

type Ymd = { y: number; m: number; d: number };

function parse(iso: string): Ymd {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

function format(ymd: Ymd): string {
  return `${String(ymd.y).padStart(4, "0")}-${String(ymd.m).padStart(2, "0")}-${String(ymd.d).padStart(2, "0")}`;
}

function addOneDay(ymd: Ymd): Ymd {
  const next = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + 1));
  return {
    y: next.getUTCFullYear(),
    m: next.getUTCMonth() + 1,
    d: next.getUTCDate(),
  };
}

function weekdaySunday0(ymd: Ymd): number {
  return new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d)).getUTCDay();
}

export function eachIsoDateInclusive(start: string, end: string): string[] {
  const dates: string[] = [];
  let current = parse(start);
  const lastIso = format(parse(end));
  while (dates.length < 400) {
    const iso = format(current);
    dates.push(iso);
    if (iso === lastIso) break;
    current = addOneDay(current);
  }
  return dates;
}

/**
 * Both endpoints inclusive: 3 March → 3 March is one day.
 * Full-day holidays count as 0; half-day holiday eves count as 0.5.
 * Weekends are skipped even when a holiday lands on them.
 */
export function countWorkingDays(
  start: string,
  end: string,
  weekendDays: number[],
  holidays: Map<string, { isHalfDay: boolean }>,
): number {
  let total = 0;
  for (const day of eachIsoDateInclusive(start, end)) {
    if (weekendDays.includes(weekdaySunday0(parse(day)))) continue;
    const holiday = holidays.get(day);
    if (holiday) {
      total += holiday.isHalfDay ? 0.5 : 0;
      continue;
    }
    total += 1;
  }
  return total;
}

export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function entitledDaysForYear(
  accrualPerMonth: number,
  startDate: string,
  year: number,
): number {
  if (accrualPerMonth <= 0) return 0;
  const yearStart = `${year}-01-01`;
  const from = startDate > yearStart ? startDate : yearStart;
  const month = Number(from.slice(5, 7));
  return roundDays(accrualPerMonth * (13 - month));
}

export function roundDays(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatMonthKey(year: number, month: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

export function parseMonthKey(
  value: string | undefined,
  fallback: { year: number; month: number },
): { year: number; month: number } {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return fallback;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return fallback;
  return { year, month };
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export function monthDateBounds(
  year: number,
  month: number,
): { start: string; end: string } {
  const start = `${formatMonthKey(year, month)}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${formatMonthKey(year, month)}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}
