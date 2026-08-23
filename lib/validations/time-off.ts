import { z } from "zod";

import { calendarSpanDays, isIsoDate } from "@/lib/domain/working-days";

const isoDate = z
  .string()
  .trim()
  .refine(isIsoDate, { message: "Pick a valid date." });

const timeOffDates = z.object({
  leaveTypeId: z.string().uuid("Pick a leave type."),
  startDate: isoDate,
  endDate: isoDate,
});

function withDateOrder<T extends z.ZodType<{ startDate: string; endDate: string }>>(
  schema: T,
) {
  return schema
    .refine((value) => value.endDate >= value.startDate, {
      message: "End date must be on or after the start date.",
      path: ["endDate"],
    })
    .refine((value) => calendarSpanDays(value.startDate, value.endDate) <= 90, {
      message: "Requests longer than 90 days need to be arranged directly.",
      path: ["endDate"],
    });
}

export const previewTimeOffSchema = withDateOrder(timeOffDates);

export const timeOffRequestSchema = withDateOrder(
  timeOffDates.extend({
    reason: z
      .union([
        z.string().trim().max(500, "Keep the reason under 500 characters."),
        z.literal(""),
      ])
      .optional()
      .transform((value) => (value ? value : undefined)),
  }),
);

export type TimeOffRequestInput = z.infer<typeof timeOffRequestSchema>;

export const MAX_TIME_OFF_ATTACHMENTS = 5;

export const decideTimeOffSchema = z.object({
  requestId: z.string().uuid(),
  note: z
    .union([z.string().trim().max(500), z.literal("")])
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export const rejectTimeOffSchema = z.object({
  requestId: z.string().uuid(),
  note: z
    .string()
    .trim()
    .min(1, "Explain the rejection.")
    .max(500, "Keep the note under 500 characters."),
});
