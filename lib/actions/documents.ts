"use server";

import { revalidatePath } from "next/cache";

import { getMyEmployeeId } from "@/lib/actions/employees";
import { fail, fromZod, ok, type ActionResult } from "@/lib/actions/result";
import { createClient } from "@/lib/supabase/server";
import {
  ALLOWED_DOCUMENT_TYPES,
  MAX_DOCUMENT_BYTES,
  type AllowedDocumentType,
  uploadDocumentSchema,
} from "@/lib/validations/documents";

const BUCKET = "documents";

export type StoredDocument = {
  id: string;
  kind: string;
  title: string;
  taxYear: number | null;
  fileSize: number;
  createdAt: string;
  employeeName?: string | null;
  visibleToManagers: boolean;
};

export async function uploadDocument(
  _previous: ActionResult<void> | null,
  formData: FormData,
): Promise<ActionResult<void>> {
  const parsed = uploadDocumentSchema.safeParse({
    companyId: formData.get("companyId"),
    employeeId: formData.get("employeeId"),
    shareWithManagers: formData.get("shareWithManagers") ?? "",
    kind: formData.get("kind"),
    title: formData.get("title"),
    taxYear: formData.get("taxYear") ?? "",
  });
  if (!parsed.success) return fromZod(parsed.error);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return fail("VALIDATION", "Choose a file to upload.", {
      file: ["Choose a file to upload."],
    });
  }

  const fileError = await checkFile(file);
  if (fileError) return fail("VALIDATION", fileError, { file: [fileError] });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Your session has expired. Sign in again.");

  const { companyId, employeeId, shareWithManagers, kind, title, taxYear } =
    parsed.data;
  const extension = ALLOWED_DOCUMENT_TYPES[file.type as AllowedDocumentType];
  const path = `${companyId}/${employeeId}/${kind}/${crypto.randomUUID()}.${extension}`;

  const upload = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (upload.error) {
    return fail("INTERNAL", storageMessage(upload.error.message));
  }

  const { error: insertError } = await supabase.from("documents").insert({
    company_id: companyId,
    employee_id: employeeId,
    kind,
    title,
    tax_year: taxYear,
    file_path: path,
    file_size: file.size,
    uploaded_by: user.id,
    visible_to_managers: shareWithManagers,
  });

  // Storage first, row second, so a failed insert leaves an orphaned object
  // rather than a row pointing at nothing. Clean it up so a retry is identical
  // to a first attempt.
  if (insertError) {
    await supabase.storage.from(BUCKET).remove([path]);
    return fail("INTERNAL", "The file uploaded but could not be recorded. Try again.");
  }

  revalidatePath(`/bookkeeper/businesses/${companyId}`);
  revalidatePath("/employee");
  revalidatePath("/employee/documents");
  revalidatePath("/manager/shared");
  revalidatePath(`/bookkeeper/businesses/${companyId}/employees/${employeeId}`);
  return ok(undefined);
}

/**
 * Documents the signed-in person may treat as their own: files filed against
 * their employee record, plus company-wide files. A bookkeeper has no employee
 * record, so personal comes back empty — their view is the per-employee page
 * under /bookkeeper, not this one.
 */
export async function listMyDocuments(membershipId: string, companyId: string) {
  const employeeId = await getMyEmployeeId(membershipId);
  const personal = employeeId
    ? await listCompanyDocuments(companyId, employeeId)
    : [];
  return { employeeId, personal };
}

export async function listCompanyDocuments(
  companyId: string,
  employeeId: string,
): Promise<StoredDocument[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documents")
    .select("id, kind, title, tax_year, file_size, created_at, visible_to_managers")
    .eq("company_id", companyId)
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []).map(mapDocument);
}

export async function listDocumentsSharedWithManagers(
  companyId: string,
): Promise<StoredDocument[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, kind, title, tax_year, file_size, created_at, visible_to_managers, employees(full_name)",
    )
    .eq("company_id", companyId)
    .eq("visible_to_managers", true)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []).map(mapDocument);
}

export async function setDocumentManagerShare(
  documentId: string,
  visible: boolean,
): Promise<ActionResult<void>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .update({ visible_to_managers: visible })
    .eq("id", documentId)
    .select("company_id, employee_id")
    .maybeSingle();

  if (error || !data) {
    return fail("FORBIDDEN", "Could not change who can open this file.");
  }

  revalidatePath("/manager/shared");
  revalidatePath(`/bookkeeper/businesses/${data.company_id}`);
  if (data.employee_id) {
    revalidatePath(
      `/bookkeeper/businesses/${data.company_id}/employees/${data.employee_id}`,
    );
  }
  return ok(undefined);
}

function mapDocument(row: {
  id: string;
  kind: string;
  title: string;
  tax_year: number | null;
  file_size: number;
  created_at: string;
  visible_to_managers?: boolean;
  employees?: { full_name: string } | { full_name: string }[] | null;
}): StoredDocument {
  const employee = Array.isArray(row.employees) ? row.employees[0] : row.employees;
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    taxYear: row.tax_year,
    fileSize: row.file_size,
    createdAt: row.created_at,
    visibleToManagers: Boolean(row.visible_to_managers),
    employeeName: employee?.full_name ?? null,
  };
}

/** How many files each employee has, for the roster on the business page. */
export async function countDocumentsByEmployee(
  companyId: string,
): Promise<Record<string, number>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documents")
    .select("employee_id")
    .eq("company_id", companyId)
    .not("employee_id", "is", null);

  if (error) return {};

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    if (row.employee_id) {
      counts[row.employee_id] = (counts[row.employee_id] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Files are never public, so viewing one means minting a short-lived signed URL
 * per request. Sixty seconds is long enough to open and too short to share.
 */
export async function getDocumentDownloadUrl(
  documentId: string,
): Promise<ActionResult<string>> {
  const supabase = await createClient();

  // Selecting the row first puts the table's own RLS in front of Storage, so a
  // caller who cannot see the document never reaches the bucket.
  const { data: document, error } = await supabase
    .from("documents")
    .select("file_path, title")
    .eq("id", documentId)
    .maybeSingle();

  if (error || !document) return fail("NOT_FOUND", "That file is no longer available.");

  // No `download` filename: that option sets Content-Disposition to attachment
  // using the human title, which has no .pdf/.jpg, so the OS opens it in a
  // text editor. Leaving it off keeps the stored Content-Type and lets the
  // browser show the PDF or image in a tab.
  const { data, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(document.file_path, 120);

  if (signError || !data) {
    return fail("INTERNAL", "Could not open that file. Try again.");
  }

  return ok(data.signedUrl);
}

/**
 * A declared MIME type is a hint the browser supplies, so the leading bytes are
 * checked too. Stops a renamed executable from being stored as a PDF.
 */
async function checkFile(file: File): Promise<string | null> {
  if (file.size > MAX_DOCUMENT_BYTES) {
    return "That file is larger than 10 MB.";
  }
  if (!(file.type in ALLOWED_DOCUMENT_TYPES)) {
    return "Only PDF, PNG, and JPEG files are accepted.";
  }

  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (!matchesSignature(file.type as AllowedDocumentType, head)) {
    return "That file's contents do not match its type.";
  }

  return null;
}

const SIGNATURES: Record<AllowedDocumentType, number[][]> = {
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/jpeg": [[0xff, 0xd8, 0xff]],
};

function matchesSignature(type: AllowedDocumentType, head: Uint8Array): boolean {
  return SIGNATURES[type].some((signature) =>
    signature.every((byte, index) => head[index] === byte),
  );
}

function storageMessage(message: string): string {
  if (/row-level security|not authorized|violates/i.test(message)) {
    return "You do not have permission to upload to this business.";
  }
  if (/exceeded the maximum|payload too large/i.test(message)) {
    return "That file is larger than the bucket allows.";
  }
  return "The upload failed. Try again.";
}
