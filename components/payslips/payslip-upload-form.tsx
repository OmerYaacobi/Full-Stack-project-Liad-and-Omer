"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { uploadPayslip } from "@/lib/actions/payslips";
import type { CompanyEmployee } from "@/lib/actions/employees";
import { parsePayslipAction } from "@/lib/actions/parse-payslip";
import { ShareWithManagersField } from "@/components/shared/share-with-managers-field";
import { PayslipLeaveFields } from "@/components/payslips/payslip-leave-fields";
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

  // Form field state for automatic pre-filling
  const [month, setMonth] = useState<number>(period.month);
  const [year, setYear] = useState<number>(period.year);
  const [grossPay, setGrossPay] = useState<string>("");
  const [netPay, setNetPay] = useState<string>("");
  const [totalDeductions, setTotalDeductions] = useState<string>("");
  const [vacationDays, setVacationDays] = useState<string>("");
  const [sickDays, setSickDays] = useState<string>("");

  // Parsing status state
  const [isParsing, setIsParsing] = useState(false);
  const [parseNotice, setParseNotice] = useState<{
    type: "success" | "warning" | "error";
    message: string;
    details?: string;
  } | null>(null);

  const failed = state?.ok === false;
  const fieldErrors = failed ? state.fieldErrors : undefined;
  const formError = failed && !fieldErrors ? state.error : undefined;

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setGrossPay("");
      setNetPay("");
      setTotalDeductions("");
      setVacationDays("");
      setSickDays("");
      setParseNotice(null);
    }
  }, [state]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setParseNotice(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await parsePayslipAction(formData);

      if (res.success && res.data) {
        const { net_pay, gross_pay, total_deductions, period_month, period_year, employee_name, employee_id, vacation_days, sick_days } = res.data;

        const filledFields: string[] = [];

        if (net_pay !== null && net_pay !== undefined) {
          setNetPay(String(net_pay));
          filledFields.push(`Net: ₪${net_pay.toLocaleString()}`);
        }
        if (gross_pay !== null && gross_pay !== undefined) {
          setGrossPay(String(gross_pay));
          filledFields.push(`Gross: ₪${gross_pay.toLocaleString()}`);
        }
        if (total_deductions !== null && total_deductions !== undefined) {
          setTotalDeductions(String(total_deductions));
          filledFields.push(`Deductions: ₪${total_deductions.toLocaleString()}`);
        }
        if (period_month !== null && period_month !== undefined) {
          setMonth(period_month);
        }
        if (period_year !== null && period_year !== undefined) {
          setYear(period_year);
        }
        if (vacation_days !== null && vacation_days !== undefined) {
          setVacationDays(String(vacation_days));
          filledFields.push(`Vacation: ${vacation_days} days`);
        }
        if (sick_days !== null && sick_days !== undefined) {
          setSickDays(String(sick_days));
          filledFields.push(`Sick: ${sick_days} days`);
        }

        let detailText = "";
        let isIdMatching = true;
        const targetId = (employee.nationalId || employee.employeeNumber || "").replace(/\D/g, "");

        if (employee_id) {
          const parsedIdClean = employee_id.replace(/\D/g, "");
          if (targetId && parsedIdClean && targetId !== parsedIdClean) {
            isIdMatching = false;
          }
        }

        if (employee_name || employee_id) {
          detailText = `Extracted: ${employee_name || ""} ${employee_id ? `(ID: ${employee_id})` : ""}`.trim();
        }

        if (!isIdMatching && employee_id) {
          setParseNotice({
            type: "warning",
            message: `⚠️ ID Mismatch: This payslip contains ID ${employee_id}, but the current employee's ID is ${employee.nationalId || employee.employeeNumber}.`,
            details: filledFields.length > 0 ? `Values filled: ${filledFields.join(", ")}` : undefined,
          });
        } else {
          setParseNotice({
            type: "success",
            message: filledFields.length > 0
              ? `✨ Connected via Employee ID (${employee_id || targetId}): Auto-filled ${filledFields.join(", ")}`
              : "✨ PDF scanned and connected to employee successfully",
            details: detailText,
          });
        }
      } else if (res.error === "SCANNED_PDF_NOT_SUPPORTED") {
        setParseNotice({
          type: "warning",
          message: "Scanned image PDF detected (no text layer). You can fill in the amounts manually.",
        });
      } else if (res.error) {
        setParseNotice({
          type: "error",
          message: res.error,
        });
      }
    } catch (err: any) {
      setParseNotice({
        type: "error",
        message: "Failed to automatically read PDF values.",
      });
    } finally {
      setIsParsing(false);
    }
  };

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
        PDF only, up to 10 MB. Saved to the payroll month as a draft. Publish
        from Payroll periods when the roster looks right.
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
            disabled={pending || isParsing}
            onChange={handleFileChange}
            className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800 disabled:opacity-60 cursor-pointer"
          />
          <FieldError messages={fieldErrors?.file} />

          {/* Parsing status banner */}
          {isParsing && (
            <div className="mt-2 flex items-center gap-2 text-xs font-medium text-indigo-700 bg-indigo-50 p-2.5 rounded-lg border border-indigo-100 animate-pulse">
              <span className="inline-block w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span>Scanning PDF & extracting payslip amounts automatically...</span>
            </div>
          )}

          {parseNotice && !isParsing && (
            <div
              className={`mt-2 text-xs p-2.5 rounded-lg border flex flex-col gap-0.5 ${
                parseNotice.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : parseNotice.type === "warning"
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-red-50 text-red-700 border-red-200"
              }`}
            >
              <div className="font-semibold">{parseNotice.message}</div>
              {parseNotice.details && (
                <div className="text-[11px] opacity-85">{parseNotice.details}</div>
              )}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="month" className="block text-sm font-medium text-slate-700">
            Month
          </label>
          <select
            id="month"
            name="month"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            disabled={pending}
            className={FIELD_CLASSES}
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
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
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
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
            value={grossPay}
            onChange={(e) => setGrossPay(e.target.value)}
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
            value={netPay}
            onChange={(e) => setNetPay(e.target.value)}
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
            value={totalDeductions}
            onChange={(e) => setTotalDeductions(e.target.value)}
            disabled={pending}
            className={FIELD_CLASSES}
          />
          <FieldError messages={fieldErrors?.totalDeductions} />
        </div>

        <PayslipLeaveFields
          vacationDays={vacationDays}
          sickDays={sickDays}
          onVacationChange={setVacationDays}
          onSickChange={setSickDays}
          disabled={pending}
        />

        <ShareWithManagersField disabled={pending} />
      </div>

      {formError && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {formError}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="mt-3 text-sm text-emerald-700">
          {state.data.published
            ? "Saved and published. They can open it under Pay slips."
            : "Saved to the payroll month. Publish it from Payroll periods when you are ready."}{" "}
          <a
            href={`/bookkeeper/periods/${state.data.periodId}`}
            className="font-medium underline underline-offset-2"
          >
            Open payroll month
          </a>
        </p>
      )}

      <button
        type="submit"
        disabled={pending || isParsing}
        className="mt-4 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
      >
        {pending ? "Saving…" : "Save to payroll month"}
      </button>
    </form>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-sm text-red-600">{messages[0]}</p>;
}
