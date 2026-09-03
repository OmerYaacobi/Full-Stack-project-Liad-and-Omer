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

export function formatTimeOffWhen(request: {
  unscheduled: boolean;
  startDate: string;
  endDate: string;
}): string {
  if (request.unscheduled) return "No specific dates";
  return formatDateRange(request.startDate, request.endDate);
}

export function formatDays(value: number): string {
  const rounded = Number(value.toFixed(2));
  if (rounded === 1) return "1 day";
  return `${rounded} days`;
}

export function formatSignedIls(amount: number): string {
  const formatted = formatIls(Math.abs(amount));
  if (amount > 0) return `+${formatted}`;
  if (amount < 0) return `−${formatted}`;
  return formatted;
}

export function formatPercent(ratio: number, digits = 0): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function shortMonthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
  }).format(new Date(year, month - 1, 1));
}

/**
 * Normalizes phone numbers to standard E.164 format (+972 for local IL numbers).
 */
export function formatPhoneE164(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("0")) {
    return `+972${cleaned.slice(1)}`;
  }
  return `+${cleaned}`;
}

