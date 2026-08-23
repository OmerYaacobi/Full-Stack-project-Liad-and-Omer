export function formatIls(amount: number): string {
  return new Intl.NumberFormat("en-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPayslipPeriod(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

export function formatIsoDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

export function formatDateRange(start: string, end: string): string {
  if (start === end) return formatIsoDate(start);
  return `${formatIsoDate(start)} – ${formatIsoDate(end)}`;
}

export function formatDays(value: number): string {
  const rounded = Number(value.toFixed(2));
  if (rounded === 1) return "1 day";
  return `${rounded} days`;
}
