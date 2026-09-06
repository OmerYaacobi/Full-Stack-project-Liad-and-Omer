import test from "node:test";
import assert from "node:assert/strict";

import {
  isIsoDate,
  calendarSpanDays,
  eachIsoDateInclusive,
  countWorkingDays,
  rangesOverlap,
  entitledDaysForYear,
  roundDays,
} from "@/lib/domain/working-days";

test("isIsoDate validates correctly", () => {
  assert.equal(isIsoDate("2026-05-14"), true);
  assert.equal(isIsoDate("2026-02-29"), false); // 2026 is not a leap year
  assert.equal(isIsoDate("invalid-date"), false);
  assert.equal(isIsoDate("2026-13-01"), false);
});

test("calendarSpanDays calculates calendar difference", () => {
  assert.equal(calendarSpanDays("2026-05-01", "2026-05-10"), 9);
  assert.equal(calendarSpanDays("2026-05-01", "2026-05-01"), 0);
});

test("eachIsoDateInclusive returns all dates inclusive", () => {
  const dates = eachIsoDateInclusive("2026-05-01", "2026-05-04");
  assert.deepEqual(dates, [
    "2026-05-01",
    "2026-05-02",
    "2026-05-03",
    "2026-05-04",
  ]);
});

test("countWorkingDays skips Israeli weekend (Friday=5, Saturday=6)", () => {
  // 2026-05-03 is Sunday, 2026-05-07 is Thursday (5 working days in Israel)
  // 2026-05-08 is Friday, 2026-05-09 is Saturday (weekend)
  const sundayToSaturday = countWorkingDays(
    "2026-05-03",
    "2026-05-09",
    [5, 6], // Israel weekend: Friday, Saturday
    new Map(),
  );
  assert.equal(sundayToSaturday, 5);
});

test("countWorkingDays accounts for full and half day holidays", () => {
  const holidays = new Map([
    ["2026-05-04", { isHalfDay: false }],
    ["2026-05-05", { isHalfDay: true }],
  ]);

  // Sunday to Thursday (5 weekdays) minus 1 full day and 0.5 half day = 3.5 days
  const result = countWorkingDays(
    "2026-05-03",
    "2026-05-07",
    [5, 6],
    holidays,
  );
  assert.equal(result, 3.5);
});

test("entitledDaysForYear computes prorated days for mid-year joiners", () => {
  // Full year: 1 day per month * 12 months = 12 days
  assert.equal(entitledDaysForYear(1, "2025-01-01", 2026), 12);
  // Joined halfway through the year (July 1st, month 7) -> 6 months = 6 days
  assert.equal(entitledDaysForYear(1, "2026-07-01", 2026), 6);
});

test("roundDays rounds to 2 decimal places", () => {
  assert.equal(roundDays(3.456), 3.46);
  assert.equal(roundDays(18.0001), 18);
});

test("rangesOverlap detects overlapping date spans", () => {
  // Direct overlap
  assert.equal(
    rangesOverlap("2026-05-01", "2026-05-10", "2026-05-05", "2026-05-15"),
    true,
  );
  // Shared boundary day
  assert.equal(
    rangesOverlap("2026-05-01", "2026-05-05", "2026-05-05", "2026-05-10"),
    true,
  );
  // Non-overlapping
  assert.equal(
    rangesOverlap("2026-05-01", "2026-05-05", "2026-05-06", "2026-05-10"),
    false,
  );
});
