"use client";

import { useActionState, useEffect, useRef } from "react";

import { uploadDocument } from "@/lib/actions/documents";
import type { CompanyEmployee } from "@/lib/actions/employees";
import { ShareWithManagersField } from "@/components/shared/share-with-managers-field";
import { DOCUMENT_KINDS } from "@/lib/validations/documents";

const FIELD_CLASSES =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50";

export function DocumentUploadForm({
  companyId,
  employees = [],
  lockedTo,
}: {
  companyId: string;
  /** Offered in the recipient list. Omit when the target is already fixed. */
  employees?: CompanyEmployee[];
  /** Set on an employee's own page, where the recipient is not in question. */
  lockedTo?: CompanyEmployee;
}) {
  const [state, submit, pending] = useActionState(uploadDocument, null);
  const formRef = useRef<HTMLFormElement>(null);

  const failed = state?.ok === false;
  const fieldErrors = failed ? state.fieldErrors : undefined;
  const formError =
    failed && !fieldErrors ? state.error : undefined;

  // Clearing the file input after a success is the only way to signal the queue
  // is empty; a file input's value cannot be set from React.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={submit}
      className="rounded-xl border border-slate-200 bg-white p-4"
    >
      <input type="hidden" name="companyId" value={companyId} />
      {lockedTo && <input type="hidden" name="employeeId" value={lockedTo.id} />}

      <h2 className="text-sm font-medium text-slate-900">
        {lockedTo ? `Upload a file for ${lockedTo.fullName}` : "Upload a file"}
      </h2>
      <p className="mt-0.5 text-xs text-slate-500">
        PDF, PNG, or JPEG, up to 10 MB. Files are private and only reachable
        through a short-lived link.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {!lockedTo && (
          <div className="sm:col-span-2">
            <label
              htmlFor="employeeId"
              className="block text-sm font-medium text-slate-700"
            >
              Who is this for?
            </label>
            <select
              id="employeeId"
              name="employeeId"
              required
              defaultValue={employees[0]?.id}
              disabled={pending}
              className={FIELD_CLASSES}
            >
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName} · #{employee.employeeNumber}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Filed against this person. Managers can open it unless you uncheck
              the box below.
            </p>
            <FieldError messages={fieldErrors?.employeeId} />
          </div>
        )}

        <div className="sm:col-span-2">
          <label htmlFor="file" className="block text-sm font-medium text-slate-700">
            File
          </label>
          <input
            id="file"
            name="file"
            type="file"
            required
            accept="application/pdf,image/png,image/jpeg"
            disabled={pending}
            className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800 disabled:opacity-60"
          />
          <FieldError messages={fieldErrors?.file} />
        </div>

        <div>
          <label htmlFor="kind" className="block text-sm font-medium text-slate-700">
            Folder
          </label>
          <select
            id="kind"
            name="kind"
            defaultValue={DOCUMENT_KINDS[0].value}
            disabled={pending}
            className={FIELD_CLASSES}
          >
            {DOCUMENT_KINDS.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
          <FieldError messages={fieldErrors?.kind} />
        </div>

        <div>
          <label htmlFor="taxYear" className="block text-sm font-medium text-slate-700">
            Tax year <span className="text-slate-400">(optional)</span>
          </label>
          <input
            id="taxYear"
            name="taxYear"
            type="number"
            min={2000}
            max={2100}
            placeholder="2026"
            disabled={pending}
            className={FIELD_CLASSES}
          />
          <FieldError messages={fieldErrors?.taxYear} />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="title" className="block text-sm font-medium text-slate-700">
            Title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            placeholder="Form 106 — 2026"
            disabled={pending}
            className={FIELD_CLASSES}
          />
          <FieldError messages={fieldErrors?.title} />
        </div>

        <ShareWithManagersField disabled={pending} />
      </div>

      {formError && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {formError}
        </p>
      )}

      {state?.ok && (
        <p role="status" className="mt-3 text-sm text-emerald-700">
          Uploaded.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Uploading…" : "Upload"}
      </button>
    </form>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-sm text-red-600">{messages[0]}</p>;
}
