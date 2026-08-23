"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { uploadPayslip } from "@/lib/actions/payslips";
import type { CompanyEmployee } from "@/lib/actions/employees";
import { parsePayslipAction } from "@/lib/actions/parse-payslip";
import { ShareWithManagersField } from "@/components/shared/share-with-managers-field";
import { PayslipLeaveFields } from "@/components/payslips/payslip-leave-fields";
import { MONTHS } from "@/lib/validations/payslips";

const FIELD_CLASSES =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50";

function defaultPeriod() {
  const last = new Date();
  last.setDate(1);
  last.setMonth(last.getMonth() - 1);
  return { year: last.getFullYear(), month: last.getMonth() + 1 };
}

export function SmartBusinessPayslipUpload({
  companyId,
  employees,
}: {
  companyId: string;
  employees: CompanyEmployee[];
}) {
  const [state, submit, pending] = useActionState(uploadPayslip, null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const period = defaultPeriod();

  // Form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [matchedEmployee, setMatchedEmployee] = useState<CompanyEmployee | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [month, setMonth] = useState<number>(period.month);
  const [year, setYear] = useState<number>(period.year);
  const [grossPay, setGrossPay] = useState<string>("");
  const [netPay, setNetPay] = useState<string>("");
  const [totalDeductions, setTotalDeductions] = useState<string>("");
  const [vacationDays, setVacationDays] = useState<string>("");
  const [sickDays, setSickDays] = useState<string>("");
  const [extractedId, setExtractedId] = useState<string | null>(null);
  const [extractedName, setExtractedName] = useState<string | null>(null);

  // Parsing & UI status
  const [isParsing, setIsParsing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const failed = state?.ok === false;
  const fieldErrors = failed ? state.fieldErrors : undefined;
  const formError = failed && !fieldErrors ? state.error : undefined;

  useEffect(() => {
    if (state?.ok) {
      const empName = matchedEmployee?.fullName || "the employee";
      setSuccessMessage(`✓ Payslip for ${MONTHS.find(m => m.value === month)?.label} ${year} successfully published and sent to ${empName}!`);
      formRef.current?.reset();
      setSelectedFile(null);
      setMatchedEmployee(null);
      setSelectedEmployeeId("");
      setGrossPay("");
      setNetPay("");
      setTotalDeductions("");
      setVacationDays("");
      setSickDays("");
      setExtractedId(null);
      setExtractedName(null);
      setParseError(null);
    }
  }, [state]);

  const handleFileSelection = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsParsing(true);
    setParseError(null);
    setSuccessMessage(null);
    setMatchedEmployee(null);
    setSelectedEmployeeId("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await parsePayslipAction(formData);

      if (res.success && res.data) {
        const { net_pay, gross_pay, total_deductions, period_month, period_year, employee_id, employee_name, vacation_days, sick_days } = res.data;

        if (net_pay !== null && net_pay !== undefined) setNetPay(String(net_pay));
        if (gross_pay !== null && gross_pay !== undefined) setGrossPay(String(gross_pay));
        if (total_deductions !== null && total_deductions !== undefined) setTotalDeductions(String(total_deductions));
        if (period_month !== null && period_month !== undefined) setMonth(period_month);
        if (period_year !== null && period_year !== undefined) setYear(period_year);
        if (vacation_days !== null && vacation_days !== undefined) setVacationDays(String(vacation_days));
        if (sick_days !== null && sick_days !== undefined) setSickDays(String(sick_days));
        if (employee_id) setExtractedId(employee_id);
        if (employee_name) setExtractedName(employee_name);

        // Find matching employee by national_id or employee_number
        let matched: CompanyEmployee | null = null;
        if (employee_id) {
          const cleanExtracted = employee_id.replace(/\D/g, "");
          matched = employees.find((emp) => {
            const empNationalId = (emp.nationalId || "").replace(/\D/g, "");
            const empNumber = (emp.employeeNumber || "").replace(/\D/g, "");
            return (
              (empNationalId.length > 0 && empNationalId === cleanExtracted) ||
              (empNumber.length > 0 && empNumber === cleanExtracted)
            );
          }) || null;
        }

        if (matched) {
          setMatchedEmployee(matched);
          setSelectedEmployeeId(matched.id);
        } else {
          setMatchedEmployee(null);
        }
      } else if (res.error) {
        setParseError(
          res.error === "SCANNED_PDF_NOT_SUPPORTED"
            ? "Scanned PDF image detected without digital text. Please fill in the details manually."
            : res.error
        );
      }
    } catch {
      setParseError("Could not automatically parse the PDF text. You can select the employee manually.");
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4 mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>📄 Smart Payslip Upload</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700">
              Auto-detects Employee by ID
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Drop or select any digital payslip PDF. The system automatically finds the matching employee by their Israeli ID number (ת.ז) and sends it directly to them.
          </p>
        </div>
      </div>

      {successMessage && (
        <div className="mb-4 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>✓</span>
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {formError && (
        <div className="mb-4 p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {formError}
        </div>
      )}

      <form ref={formRef} action={submit} className="space-y-4">
        <input type="hidden" name="companyId" value={companyId} />

        {/* File Picker */}
        <div>
          <label htmlFor="smart-payslip-file" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Select Digital Payslip PDF <span className="text-red-500">*</span>
          </label>
          <input
            id="smart-payslip-file"
            name="file"
            type="file"
            accept=".pdf,application/pdf"
            required
            disabled={isParsing || pending}
            onChange={handleFileSelection}
            className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-700 disabled:opacity-60 cursor-pointer border border-slate-300 rounded-xl p-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {isParsing && (
            <div className="mt-2 flex items-center gap-2 text-indigo-600 text-xs font-medium">
              <div className="animate-spin h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full" />
              <span>Scanning PDF text and identifying employee by ID...</span>
            </div>
          )}
          {selectedFile && !isParsing && (
            <p className="mt-1 text-xs text-slate-500 font-medium">
              📄 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            </p>
          )}
          {fieldErrors?.file && (
            <p className="text-xs text-red-600 mt-1">{fieldErrors.file[0]}</p>
          )}
          {parseError && (
            <p className="text-xs text-amber-700 mt-1 bg-amber-50 p-2 rounded-lg border border-amber-200">
              ⚠️ {parseError}
            </p>
          )}
        </div>

        {/* Identification & Employee Match Status Banner */}
        {selectedFile && !isParsing && (
          <div className={`p-4 rounded-xl border ${
            matchedEmployee
              ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
              : "bg-amber-50/70 border-amber-200 text-amber-900"
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                {matchedEmployee ? (
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold">✓</span>
                    <div>
                      <p className="text-sm font-bold text-emerald-950">
                        Automatically matched to: {matchedEmployee.fullName}
                      </p>
                      <p className="text-xs text-emerald-700">
                        National ID: <span className="font-semibold">{matchedEmployee.nationalId || matchedEmployee.employeeNumber}</span>
                        {matchedEmployee.jobTitle ? ` · ${matchedEmployee.jobTitle}` : ""}
                        {matchedEmployee.department ? ` (${matchedEmployee.department})` : ""}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-bold text-amber-950">
                      ⚠️ No employee registered with ID {extractedId || "found in PDF"}
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      {extractedName ? `Name on PDF: "${extractedName}". ` : ""}
                      Please select the matching employee from the list below:
                    </p>
                  </div>
                )}
              </div>

              {/* Employee ID hidden input (or manual selector if no match) */}
              {matchedEmployee ? (
                <input type="hidden" name="employeeId" value={matchedEmployee.id} />
              ) : (
                <div className="min-w-[220px]">
                  <select
                    name="employeeId"
                    required
                    value={selectedEmployeeId}
                    onChange={(e) => {
                      setSelectedEmployeeId(e.target.value);
                      const found = employees.find(emp => emp.id === e.target.value);
                      setMatchedEmployee(found || null);
                    }}
                    className="w-full text-xs font-medium rounded-lg border border-amber-300 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="">Select Employee Manually...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName} ({emp.nationalId ? `ID: ${emp.nationalId}` : `#${emp.employeeNumber}`})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payslip Fields: Month, Year, Gross, Net, Deductions */}
        {selectedFile && !isParsing && (
          <div className="pt-2 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="month" className="block text-xs font-semibold text-slate-700 mb-1">
                  Payroll Month <span className="text-red-500">*</span>
                </label>
                <select
                  id="month"
                  name="month"
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className={FIELD_CLASSES}
                  required
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label} ({m.value})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="year" className="block text-xs font-semibold text-slate-700 mb-1">
                  Payroll Year <span className="text-red-500">*</span>
                </label>
                <input
                  id="year"
                  name="year"
                  type="number"
                  min={2000}
                  max={2100}
                  required
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className={FIELD_CLASSES}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="grossPay" className="block text-xs font-semibold text-slate-700 mb-1">
                  Gross Pay (₪)
                </label>
                <input
                  id="grossPay"
                  name="grossPay"
                  type="number"
                  step="0.01"
                  min="0"
                  value={grossPay}
                  onChange={(e) => setGrossPay(e.target.value)}
                  placeholder="e.g. 12500.00"
                  className={FIELD_CLASSES}
                />
              </div>

              <div>
                <label htmlFor="totalDeductions" className="block text-xs font-semibold text-slate-700 mb-1">
                  Deductions (₪)
                </label>
                <input
                  id="totalDeductions"
                  name="totalDeductions"
                  type="number"
                  step="0.01"
                  min="0"
                  value={totalDeductions}
                  onChange={(e) => setTotalDeductions(e.target.value)}
                  placeholder="e.g. 2450.00"
                  className={FIELD_CLASSES}
                />
              </div>

              <div>
                <label htmlFor="netPay" className="block text-xs font-semibold text-slate-700 mb-1">
                  Net Pay (₪)
                </label>
                <input
                  id="netPay"
                  name="netPay"
                  type="number"
                  step="0.01"
                  min="0"
                  value={netPay}
                  onChange={(e) => setNetPay(e.target.value)}
                  placeholder="e.g. 10050.00"
                  className={FIELD_CLASSES}
                />
                {fieldErrors?.netPay && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.netPay[0]}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PayslipLeaveFields
                vacationDays={vacationDays}
                sickDays={sickDays}
                onVacationChange={setVacationDays}
                onSickChange={setSickDays}
                disabled={pending}
                compact
              />
            </div>

            <div className="pt-2">
              <ShareWithManagersField defaultChecked={false} />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={pending || isParsing || (!matchedEmployee && !selectedEmployeeId)}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {pending ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    <span>Uploading and Sending Payslip...</span>
                  </>
                ) : (
                  <span>
                    🚀 Upload & Send to {matchedEmployee ? matchedEmployee.fullName : "Selected Employee"}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

