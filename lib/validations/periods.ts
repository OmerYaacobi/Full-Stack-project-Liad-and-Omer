import { z } from "zod";

export const openPayrollPeriodSchema = z.object({
  companyId: z.string().uuid("Pick a business."),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const publishPayrollPeriodSchema = z.object({
  periodId: z.string().uuid(),
});

export type PeriodStatus = "draft" | "published" | "locked";
