"use client";

import { useActionState, useEffect, useRef } from "react";

import { uploadOwnForm101 } from "@/lib/actions/documents";

const FIELD =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50";

export function Form101Upload({ taxYear }: { taxYear: number }) {
  const [state, submit, pending] = useActionState(uploadOwnForm101, null);
  const formRef = useRef<HTMLFormElement>(null);
  const failed = state?.ok === false;
  const fieldErrors = failed ? state.fieldErrors : undefined;
  const formError = failed && !fieldErrors ? state.error : undefined;

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={submit} className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-medium text-slate-900">Already completed a 101?</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Upload the PDF you saved from the Form 101 site, or a photo of a paper
        form.
      </p>
      <div className="mt-4">
        <label htmlFor="form101-file" className="block text-sm font-medium text-slate-700">
          File
        </label>
        <input
          id="form101-file"
          name="file"
          type="file"
          required
          accept="application/pdf,image/png,image/jpeg"
          disabled={pending}
          className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800 disabled:opacity-60"
        />
        {fieldErrors?.file ? (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.file[0]}</p>
        ) : null}
      </div>
      <label htmlFor="uploadTaxYear" className="mt-4 block text-sm font-medium text-slate-700">
        Tax year
      </label>
      <input
        id="uploadTaxYear"
        name="taxYear"
        type="number"
        min={2000}
        max={2100}
        defaultValue={taxYear}
        disabled={pending}
        className={FIELD}
      />
      {formError ? (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {formError}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="mt-3 text-sm text-emerald-700">
          Uploaded. It appears in your Form 101 folder.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
      >
        {pending ? "Uploading…" : "Upload completed form"}
      </button>
    </form>
  );
}
