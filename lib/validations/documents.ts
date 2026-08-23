import { z } from "zod";

/**
 * Mirrors the `kind` check constraint on `public.documents`. The order here is
 * the order the folders appear on screen.
 */
export const DOCUMENT_KINDS = [
  { value: "form_106", label: "Form 106", hint: "Annual earnings summary" },
  { value: "form_101", label: "Form 101", hint: "Tax coordination form" },
  { value: "contract", label: "Contracts", hint: "Employment agreements" },
  {
    value: "pension_report",
    label: "Pension reports",
    hint: "Provident and pension statements",
  },
  { value: "other", label: "Other", hint: "Anything without its own folder" },
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number]["value"];

export const DOCUMENT_KIND_VALUES = DOCUMENT_KINDS.map((k) => k.value) as [
  DocumentKind,
  ...DocumentKind[],
];

export function documentKindLabel(kind: string): string {
  return DOCUMENT_KINDS.find((k) => k.value === kind)?.label ?? "Other";
}

// Matches the bucket's own file_size_limit and allowed_mime_types, so an
// oversized or wrong-typed file is rejected before it leaves the server rather
// than by a storage error the user cannot read.
export const MAX_DOCUMENT_BYTES = 10_485_760;

export const ALLOWED_DOCUMENT_TYPES = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
} as const;

export type AllowedDocumentType = keyof typeof ALLOWED_DOCUMENT_TYPES;

export const uploadDocumentSchema = z.object({
  companyId: z.string().uuid("Pick a business first."),
  employeeId: z.string().uuid("Choose an employee. Files are always filed to one person."),
  shareWithManagers: z
    .union([z.literal("on"), z.literal("true"), z.literal(""), z.null()])
    .optional()
    .transform((value) => value === "on" || value === "true"),
  kind: z.enum(DOCUMENT_KIND_VALUES, { message: "Choose a folder." }),
  title: z
    .string()
    .trim()
    .min(2, "Give the file a title of at least 2 characters.")
    .max(160, "That title is too long."),
  taxYear: z
    .union([z.coerce.number().int().min(2000).max(2100), z.literal("")])
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
