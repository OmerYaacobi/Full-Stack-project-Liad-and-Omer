"use client";

import { useActionState, useEffect, useRef } from "react";

import { uploadPayslip } from "@/lib/actions/payslips";
import type { CompanyEmployee } from "@/lib/actions/employees";
import { ShareWithManagersField } from "@/components/shared/share-with-managers-field";
import { MONTHS } from "@/lib/validations/payslips";

const FIELD_CLASSES =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50";

function defaultPeriod() {
  const last = new Date();
  last.setDate(1);
  last.setMonth(last.getMonth() - 1);
  return { year: last.getFullYear(), month: last.getMonth() + 1 };
}

export function PayslipUploadForm({
  companyId,
  employee,
}: {
  companyId: string;
  employee: CompanyEmployee;
}) {
  const [state, submit, pending] = useActionState(uploadPayslip, null);
  const formRef = useRef<HTMLFormElement>(null);
  const period = defaultPeriod();

  const failed = state?.ok === false;
  const fieldErrors = failed ? state.fieldErrors : undefined;
  const formError = failed && !fieldErrors ? state.error : undefined;

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
      <input type="hidden" name="employeeId" value={employee.id} />

      <h2 className="text-sm font-medium text-slate-900">
        Upload a pay slip for {employee.fullName}
      </h2>
      <p className="mt-0.5 text-xs text-slate-500">
        PDF only, up to 10 MB. Publishing happens on upload so they can open it
        immediately.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="payslip-file" className="block text-sm font-medium text-slate-700">
            File
          </label>
          <input
            id="payslip-file"
            name="file"
            type="file"
            required
            accept="application/pdf"
            disabled={pending}
            className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800 disabled:opacity-60"
          />
          <FieldError messages={fieldErrors?.file} />
        </div>

        <div>
          <label htmlFor="month" className="block text-sm font-medium text-slate-700">
            Month
          </label>
          <select
            id="month"
            name="month"
            defaultValue={period.month}
            disabled={pending}
            className={FIELD_CLASSES}
          >
            {MONTHS.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="year" className="block text-sm font-medium text-slate-700">
            Year
          </label>
          <input
            id="year"
            name="year"
            type="number"
            min={2000}
            max={2100}
            defaultValue={period.year}
            required
            disabled={pending}
            className={FIELD_CLASSES}
          />
        </div>

        <div>
          <label htmlFor="grossPay" className="block text-sm font-medium text-slate-700">
            Gross <span className="text-slate-400">(optional)</span>
          </label>
          <input
            id="grossPay"
            name="grossPay"
            type="number"
            min={0}
            step="0.01"
            placeholder="0"
            disabled={pending}
            className={FIELD_CLASSES}
          />
          <FieldError messages={fieldErrors?.grossPay} />
        </div>

        <div>
          <label htmlFor="netPay" className="block text-sm font-medium text-slate-700">
            Net <span className="text-slate-400">(optional)</span>
          </label>
          <input
            id="netPay"
            name="netPay"
            type="number"
            min={0}
            step="0.01"
            placeholder="0"
            disabled={pending}
            className={FIELD_CLASSES}
          />
          <FieldError messages={fieldErrors?.netPay} />
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor="totalDeductions"
            className="block text-sm font-medium text-slate-700"
          >
            Deductions <span className="text-slate-400">(optional)</span>
          </label>
          <input
            id="totalDeductions"
            name="totalDeductions"
            type="number"
            min={0}
            step="0.01"
            placeholder="0"
            disabled={pending}
            className={FIELD_CLASSES}
          />
          <FieldError messages={fieldErrors?.totalDeductions} />
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
          Published. They can open it under Pay slips.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Publishing…" : "Upload and publish"}
      </button>
    </form>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-sm text-red-600">{messages[0]}</p>;
}
