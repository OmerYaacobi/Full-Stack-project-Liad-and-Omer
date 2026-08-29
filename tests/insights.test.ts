import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPayInsights,
  volatilityLabel,
  type PayMonth,
} from "@/lib/domain/insights";

test("buildPayInsights handles empty months list", () => {
  const insights = buildPayInsights([]);
  assert.equal(insights.latest, null);
  assert.equal(insights.previous, null);
  assert.equal(insights.rollingAverage, null);
  assert.equal(insights.ytdTotal, 0);
  assert.equal(insights.deductionRate, null);
});

test("buildPayInsights calculates delta, rolling average and deduction rate", () => {
  const months: PayMonth[] = [
    { year: 2026, month: 1, grossPay: 10000, totalDeductions: 2000, netPay: 8000 },
    { year: 2026, month: 2, grossPay: 10000, totalDeductions: 2000, netPay: 8000 },
    { year: 2026, month: 3, grossPay: 12000, totalDeductions: 3000, netPay: 9000 },
  ];

  // now in 2026
  const insights = buildPayInsights(months, new Date("2026-04-01"));

  assert.equal(insights.latest?.month, 3);
  assert.equal(insights.latest?.netPay, 9000);
  assert.equal(insights.previous?.month, 2);
  assert.equal(insights.previous?.netPay, 8000);

  // Delta: 9000 - 8000 = 1000 (+12.5%)
  assert.equal(insights.deltaAmount, 1000);
  assert.equal(insights.deltaPercent, 0.125);

  // Rolling average of 8000, 8000, 9000 = 8333.33
  assert.ok(insights.rollingAverage !== null);
  assert.equal(Math.round(insights.rollingAverage), 8333);

  // Deduction rate: 3000 / 12000 = 25%
  assert.equal(insights.deductionRate, 0.25);

  // YTD total: 8000 + 8000 + 9000 = 25000
  assert.equal(insights.ytdTotal, 25000);
  assert.equal(insights.ytdCount, 3);
});

test("volatilityLabel returns correct descriptions", () => {
  assert.equal(volatilityLabel("stable"), "Stable");
  assert.equal(volatilityLabel("some"), "Some variation");
  assert.equal(volatilityLabel("variable"), "Highly variable");
});

