/**
 * Salary insight math for the employee and manager dashboards.
 * Operates on published months only; callers must not pass draft slips.
 */

export type PayMonth = {
  year: number;
  month: number;
  grossPay: number;
  netPay: number;
  totalDeductions: number;
};

export type VolatilityKind = "stable" | "some" | "variable";

export type PayInsights = {
  months: PayMonth[];
  latest: PayMonth | null;
  previous: PayMonth | null;
  deltaAmount: number | null;
  deltaPercent: number | null;
  rollingAverage: number | null;
  rollingCount: number;
  ytdTotal: number;
  ytdAverage: number | null;
  ytdCount: number;
  deductionRate: number | null;
  minNet: number | null;
  maxNet: number | null;
  volatility: number | null;
  volatilityKind: VolatilityKind | null;
};

const MIN_MONTHS_FOR_AVERAGE = 3;

export function buildPayInsights(
  months: PayMonth[],
  now = new Date(),
): PayInsights {
  const unique = newestUniqueMonths(months);
  const lastTwelve = unique.slice(0, 12);
  const chronological = [...lastTwelve].reverse();
  const latest = lastTwelve[0] ?? null;
  const previous = lastTwelve[1] ?? null;

  const nets = lastTwelve.map((row) => row.netPay);
  const rollingCount = lastTwelve.length;
  const rollingAverage =
    rollingCount >= MIN_MONTHS_FOR_AVERAGE ? mean(nets) : null;

  const year = now.getFullYear();
  const ytd = unique.filter((row) => row.year === year);
  const ytdNets = ytd.map((row) => row.netPay);
  const ytdCount = ytd.length;
  const ytdTotal = ytdNets.reduce((sum, value) => sum + value, 0);
  const ytdAverage = ytdCount >= 2 ? mean(ytdNets) : null;

  const deltaAmount =
    latest && previous ? latest.netPay - previous.netPay : null;
  const deltaPercent =
    deltaAmount !== null && previous && previous.netPay !== 0
      ? deltaAmount / previous.netPay
      : null;

  const deductionRate =
    latest && latest.grossPay > 0
      ? latest.totalDeductions / latest.grossPay
      : null;

  const volatility =
    rollingCount >= MIN_MONTHS_FOR_AVERAGE ? coefficientOfVariation(nets) : null;

  return {
    months: chronological,
    latest,
    previous,
    deltaAmount,
    deltaPercent,
    rollingAverage,
    rollingCount,
    ytdTotal,
    ytdAverage,
    ytdCount,
    deductionRate,
    minNet: nets.length ? Math.min(...nets) : null,
    maxNet: nets.length ? Math.max(...nets) : null,
    volatility,
    volatilityKind: volatilityKind(volatility),
  };
}

export function volatilityLabel(kind: VolatilityKind): string {
  switch (kind) {
    case "stable":
      return "Stable";
    case "some":
      return "Some variation";
    case "variable":
      return "Highly variable";
  }
}

export function volatilityHint(kind: VolatilityKind): string {
  switch (kind) {
    case "stable":
      return "Take-home is about the same each month";
    case "some":
      return "Occasional overtime or bonuses";
    case "variable":
      return "Hours, commission, or irregular extras";
  }
}

function newestUniqueMonths(months: PayMonth[]): PayMonth[] {
  const byKey = new Map<string, PayMonth>();
  for (const month of months) {
    const key = `${month.year}-${month.month}`;
    if (!byKey.has(key)) byKey.set(key, month);
  }
  return [...byKey.values()].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Sample coefficient of variation: stddev_samp / mean. */
function coefficientOfVariation(values: number[]): number | null {
  if (values.length < 2) return null;
  const avg = mean(values);
  if (avg === 0) return null;
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) /
    (values.length - 1);
  return Math.sqrt(variance) / avg;
}

function volatilityKind(cv: number | null): VolatilityKind | null {
  if (cv === null) return null;
  if (cv < 0.05) return "stable";
  if (cv <= 0.15) return "some";
  return "variable";
}
