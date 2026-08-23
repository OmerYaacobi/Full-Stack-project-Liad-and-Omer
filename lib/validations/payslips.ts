import { z } from "zod";

export const MAX_PAYSLIP_BYTES = 10_485_760;

export const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
] as const;

export function monthLabel(month: number): string {
  return MONTHS.find((item) => item.value === month)?.label ?? `Month ${month}`;
}

function optionalMoney(message: string) {
  return z
    .union([z.coerce.number().min(0, message), z.literal("")])
    .optional()
    .transform((value) => (value === "" || value === undefined ? 0 : value));
}

export const uploadPayslipSchema = z
  .object({
    companyId: z.string().uuid("Pick a business first."),
    employeeId: z.string().uuid("Pick an employee first."),
    shareWithManagers: z
      .union([z.literal("on"), z.literal("true"), z.literal(""), z.null()])
      .optional()
      .transform((value) => value === "on" || value === "true"),
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
    grossPay: optionalMoney("Gross pay cannot be negative."),
    netPay: optionalMoney("Net pay cannot be negative."),
    totalDeductions: optionalMoney("Deductions cannot be negative."),
  })
  .refine((data) => data.netPay <= data.grossPay, {
    message: "Net pay cannot be higher than gross pay.",
    path: ["netPay"],
  });

export type UploadPayslipInput = z.infer<typeof uploadPayslipSchema>;
