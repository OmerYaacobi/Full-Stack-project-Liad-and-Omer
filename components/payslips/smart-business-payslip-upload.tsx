"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { PayslipLeaveFields } from "@/components/payslips/payslip-leave-fields";
import { ShareWithManagersField } from "@/components/shared/share-with-managers-field";
import { uploadPayslip } from "@/lib/actions/payslips";
import type { CompanyEmployee } from "@/lib/actions/employees";
import { parsePayslipAction } from "@/lib/actions/parse-payslip";
import { matchEmployeeById } from "@/lib/payslip/match-employee";
import { MAX_PAYSLIP_BATCH, MONTHS, monthLabel } from "@/lib/validations/payslips";

const FIELD_CLASSES =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50";

type DraftStatus = "parsing" | "ready" | "unmatched" | "error";

type PayslipDraft = {
  id: string;
  file: File;
  status: DraftStatus;
  parseError: string | null;
  publishError: string | null;
  employeeId: string;
  extractedId: string | null;
  extractedName: string | null;
  month: number;
  year: number;
  grossPay: string;
  netPay: string;
  totalDeductions: string;
  vacationDays: string;
  sickDays: string;
};

function defaultPeriod() {
  const last = new Date();
  last.setDate(1);
  last.setMonth(last.getMonth() - 1);
  return { year: last.getFullYear(), month: last.getMonth() + 1 };
}

function periodKey(draft: PayslipDraft): string {
  if (draft.status === "parsing") return "reading";
  if (!draft.month || !draft.year) return "unknown";
  return `${draft.year}-${String(draft.month).padStart(2, "0")}`;
}

function emptyDraft(file: File, period: { month: number; year: number }): PayslipDraft {
  return {
    id: crypto.randomUUID(),
    file,
    status: "parsing",
    parseError: null,
    publishError: null,
    employeeId: "",
    extractedId: null,
    extractedName: null,
    month: period.month,
    year: period.year,
    grossPay: "",
    netPay: "",
    totalDeductions: "",
    vacationDays: "",
    sickDays: "",
  };
}

async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  async function run() {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run()),
  );
}

export function SmartBusinessPayslipUpload({
  companyId,
  employees,
}: {
  companyId: string;
  employees: CompanyEmployee[];
}) {
  const period = defaultPeriod();

  const [drafts, setDrafts] = useState<PayslipDraft[]>([]);
  const [shareWithManagers, setShareWithManagers] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [successHref, setSuccessHref] = useState<string | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);

  const parsingCount = drafts.filter((draft) => draft.status === "parsing").length;
  const readyDrafts = drafts.filter((draft) => draft.employeeId && draft.status !== "parsing");
  const duplicateKeys = useMemo(() => {
    const counts = new Map<string, number>();
    for (const draft of drafts) {
      if (!draft.employeeId) continue;
      const key = `${draft.employeeId}:${draft.year}-${draft.month}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return new Set(
      [...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key),
    );
  }, [drafts]);

  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, PayslipDraft[]>();
    for (const draft of drafts) {
      const key = periodKey(draft);
      if (!map.has(key)) {
        map.set(key, []);
        order.push(key);
      }
      map.get(key)!.push(draft);
    }
    order.sort((a, b) => {
      if (a === "reading") return -1;
      if (b === "reading") return 1;
      if (a === "unknown") return 1;
      if (b === "unknown") return -1;
      return b.localeCompare(a);
    });
    return order.map((key) => ({ key, drafts: map.get(key) ?? [] }));
  }, [drafts]);

  function patchDraft(id: string, patch: Partial<PayslipDraft>) {
    setDrafts((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)),
    );
  }

  async function parseFiles(files: File[]) {
    const incoming = files.filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    if (incoming.length === 0) {
      setBatchError("Choose PDF pay slips.");
      return;
    }
    if (drafts.length + incoming.length > MAX_PAYSLIP_BATCH) {
      setBatchError(`You can upload up to ${MAX_PAYSLIP_BATCH} PDFs at once.`);
      return;
    }

    setBatchError(null);
    setSuccessMessage(null);
    const created = incoming.map((file) => emptyDraft(file, period));
    setDrafts((current) => [...current, ...created]);

    await runPool(created, 3, async (draft) => {
      try {
        const formData = new FormData();
        formData.append("file", draft.file);
        const res = await parsePayslipAction(formData);

        if (!res.success || !res.data) {
          patchDraft(draft.id, {
            status: "error",
            parseError:
              res.error === "SCANNED_PDF_NOT_SUPPORTED"
                ? "This PDF has no digital text. Pick the employee and month by hand."
                : (res.error ?? "Could not read this PDF."),
          });
          return;
        }

        const {
          net_pay,
          gross_pay,
          total_deductions,
          period_month,
          period_year,
          employee_id,
          employee_name,
          vacation_days,
          sick_days,
        } = res.data;

        const matched = matchEmployeeById(employees, employee_id);
        patchDraft(draft.id, {
          status: matched ? "ready" : "unmatched",
          parseError: matched
            ? null
            : employee_id
              ? `No employee on this payroll with ID ${employee_id}.`
              : "No ID found on this slip.",
          employeeId: matched?.id ?? "",
          extractedId: employee_id,
          extractedName: employee_name,
          month: period_month ?? period.month,
          year: period_year ?? period.year,
          grossPay: gross_pay != null ? String(gross_pay) : "",
          netPay: net_pay != null ? String(net_pay) : "",
          totalDeductions: total_deductions != null ? String(total_deductions) : "",
          vacationDays: vacation_days != null ? String(vacation_days) : "",
          sickDays: sick_days != null ? String(sick_days) : "",
        });
      } catch {
        patchDraft(draft.id, {
          status: "error",
          parseError: "Could not read this PDF. You can still assign it by hand.",
        });
      }
    });
  }

  async function handleFileSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    await parseFiles(files);
  }

  function removeDraft(id: string) {
    setDrafts((current) => current.filter((draft) => draft.id !== id));
  }

  async function saveReady() {
    const toSave = drafts.filter(
      (draft) => draft.status !== "parsing" && draft.employeeId,
    );
    if (toSave.length === 0) return;

    setIsSaving(true);
    setSaveProgress({ done: 0, total: toSave.length });
    setBatchError(null);
    setSuccessMessage(null);
    setSuccessHref(null);

    const succeeded = new Set<string>();
    const periodIds = new Set<string>();
    let publishedCount = 0;
    let failCount = 0;

    for (let index = 0; index < toSave.length; index += 1) {
      const draft = toSave[index];
      const formData = new FormData();
      formData.set("companyId", companyId);
      formData.set("employeeId", draft.employeeId);
      formData.set("year", String(draft.year));
      formData.set("month", String(draft.month));
      formData.set("grossPay", draft.grossPay);
      formData.set("netPay", draft.netPay);
      formData.set("totalDeductions", draft.totalDeductions);
      formData.set("vacationDays", draft.vacationDays);
      formData.set("sickDays", draft.sickDays);
      formData.set("file", draft.file);
      if (shareWithManagers) formData.set("shareWithManagers", "on");

      const result = await uploadPayslip(null, formData);
      if (result.ok) {
        succeeded.add(draft.id);
        periodIds.add(result.data.periodId);
        if (result.data.published) publishedCount += 1;
      } else {
        failCount += 1;
        patchDraft(draft.id, { publishError: result.error });
      }
      setSaveProgress({ done: index + 1, total: toSave.length });
    }

    setDrafts((current) => current.filter((draft) => !succeeded.has(draft.id)));
    setIsSaving(false);
    setSaveProgress(null);

    if (succeeded.size > 0) {
      const draftCount = succeeded.size - publishedCount;
      let message = `Saved ${succeeded.size} payslip${succeeded.size === 1 ? "" : "s"} as a draft. Publish the month from Payroll periods when the roster looks right.`;
      if (publishedCount > 0 && draftCount > 0) {
        message = `Saved ${succeeded.size} payslip${succeeded.size === 1 ? "" : "s"}. ${publishedCount} went live because those months were already published.`;
      } else if (publishedCount === succeeded.size) {
        message = `Saved and published ${succeeded.size} payslip${succeeded.size === 1 ? "" : "s"} — those months were already live.`;
      }
      if (failCount > 0) {
        message += ` ${failCount} still need attention.`;
      }
      setSuccessMessage(message);
      setSuccessHref(
        periodIds.size === 1
          ? `/bookkeeper/periods/${[...periodIds][0]}`
          : "/bookkeeper/periods",
      );
    } else {
      setBatchError("None of the payslips could be saved. Check the errors on each file.");
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4 mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>📄 Smart Payslip Upload</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700">
              Matches by ID and month
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Select one or many digital payslip PDFs. Each file is matched to the right person by ת.ז / employee number and to the right payroll month, then saved as a draft. Publish the month from Payroll periods when the roster looks right.
          </p>
        </div>
      </div>

      {successMessage && (
        <div className="mb-4 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between gap-3">
          <span>
            ✓ {successMessage}
            {successHref ? (
              <>
                {" "}
                <Link href={successHref} className="font-semibold underline underline-offset-2">
                  Open payroll month
                </Link>
              </>
            ) : null}
          </span>
          <button
            type="button"
            onClick={() => {
              setSuccessMessage(null);
              setSuccessHref(null);
            }}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {batchError && (
        <div className="mb-4 p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {batchError}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="smart-payslip-file" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Select payslip PDFs <span className="text-red-500">*</span>
          </label>
          <input
            id="smart-payslip-file"
            name="files"
            type="file"
            accept=".pdf,application/pdf"
            multiple
            disabled={parsingCount > 0 || isSaving}
            onChange={handleFileSelection}
            className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-700 disabled:opacity-60 cursor-pointer border border-slate-300 rounded-xl p-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {parsingCount > 0 && (
            <div className="mt-2 flex items-center gap-2 text-indigo-600 text-xs font-medium">
              <div className="animate-spin h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full" />
              <span>
                Reading {parsingCount} PDF{parsingCount === 1 ? "" : "s"} and matching ID / month...
              </span>
            </div>
          )}
          {drafts.length > 0 && parsingCount === 0 && (
            <p className="mt-1 text-xs text-slate-500 font-medium">
              {drafts.length} file{drafts.length === 1 ? "" : "s"} ready to review. You can add more PDFs before saving.
            </p>
          )}
        </div>

        {groups.map((group) => (
          <section key={group.key} className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {groupTitle(group.key, group.drafts.length)}
            </h3>
            {group.drafts.map((draft) => {
              const employee = employees.find((row) => row.id === draft.employeeId) ?? null;
              const isDuplicate = Boolean(
                draft.employeeId &&
                  duplicateKeys.has(`${draft.employeeId}:${draft.year}-${draft.month}`),
              );
              return (
                <DraftCard
                  key={draft.id}
                  draft={draft}
                  employee={employee}
                  employees={employees}
                  isDuplicate={isDuplicate}
                  disabled={isSaving}
                  onChange={(patch) => patchDraft(draft.id, patch)}
                  onRemove={() => removeDraft(draft.id)}
                />
              );
            })}
          </section>
        ))}

        {drafts.length > 0 && (
          <>
            <ShareWithManagersField
              checked={shareWithManagers}
              onChange={setShareWithManagers}
              disabled={isSaving}
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => void saveReady()}
                disabled={
                  isSaving || parsingCount > 0 || readyDrafts.length === 0
                }
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSaving && saveProgress ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    <span>
                      Saving {saveProgress.done} of {saveProgress.total}...
                    </span>
                  </>
                ) : (
                  <span>
                    Save {readyDrafts.length} payslip
                    {readyDrafts.length === 1 ? "" : "s"} to payroll
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDrafts([]);
                  setBatchError(null);
                }}
                disabled={isSaving || parsingCount > 0}
                className="sm:w-auto py-2.5 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                Clear list
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function groupTitle(key: string, count: number): string {
  if (key === "reading") return `Reading files · ${count}`;
  if (key === "unknown") return `Needs a month · ${count}`;
  const [year, month] = key.split("-");
  return `${monthLabel(Number(month))} ${year} · ${count} slip${count === 1 ? "" : "s"}`;
}

function DraftCard({
  draft,
  employee,
  employees,
  isDuplicate,
  disabled,
  onChange,
  onRemove,
}: {
  draft: PayslipDraft;
  employee: CompanyEmployee | null;
  employees: CompanyEmployee[];
  isDuplicate: boolean;
  disabled: boolean;
  onChange: (patch: Partial<PayslipDraft>) => void;
  onRemove: () => void;
}) {
  const matched = draft.status === "ready" && employee;

  return (
    <article className="rounded-xl border border-slate-200 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{draft.file.name}</p>
          <p className="text-xs text-slate-500">
            {(draft.file.size / 1024).toFixed(1)} KB
            {draft.extractedId ? ` · ID ${draft.extractedId}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled || draft.status === "parsing"}
          className="shrink-0 text-xs font-semibold text-slate-500 hover:text-red-700 disabled:opacity-40"
        >
          Remove
        </button>
      </div>

      {draft.status === "parsing" && (
        <p className="text-xs text-indigo-600 font-medium">Scanning PDF…</p>
      )}

      {(draft.parseError || draft.publishError) && draft.status !== "parsing" && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
          {draft.publishError ?? draft.parseError}
        </p>
      )}

      {isDuplicate && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
          Another file in this batch is for the same person and month. Saving will replace the earlier slip.
        </p>
      )}

      {draft.status !== "parsing" && (
        <>
          <div
            className={`rounded-lg border p-3 ${
              matched
                ? "bg-emerald-50/70 border-emerald-200"
                : "bg-amber-50/70 border-amber-200"
            }`}
          >
            <label className="block text-xs font-semibold text-slate-800 mb-1">
              {matched ? "Matched employee" : "Assign employee"}
              <select
                value={draft.employeeId}
                disabled={disabled}
                onChange={(event) => {
                  const nextId = event.target.value;
                  onChange({
                    employeeId: nextId,
                    status: nextId ? "ready" : "unmatched",
                    parseError: nextId ? null : draft.parseError,
                  });
                }}
                className={`mt-1 w-full text-sm font-medium rounded-lg border bg-white px-3 py-2 text-slate-800 ${
                  matched ? "border-emerald-300" : "border-amber-300"
                }`}
              >
                <option value="">Select employee…</option>
                {employees.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.fullName} (
                    {row.nationalId ? `ID: ${row.nationalId}` : `#${row.employeeNumber}`})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-slate-700">
              Month
              <select
                value={draft.month}
                disabled={disabled}
                onChange={(event) => onChange({ month: Number(event.target.value) })}
                className={FIELD_CLASSES}
              >
                {MONTHS.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Year
              <input
                type="number"
                min={2000}
                max={2100}
                value={draft.year}
                disabled={disabled}
                onChange={(event) => onChange({ year: Number(event.target.value) })}
                className={FIELD_CLASSES}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block text-xs font-semibold text-slate-700">
              Gross (₪)
              <input
                type="number"
                step="0.01"
                min="0"
                value={draft.grossPay}
                disabled={disabled}
                onChange={(event) => onChange({ grossPay: event.target.value })}
                className={FIELD_CLASSES}
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Deductions (₪)
              <input
                type="number"
                step="0.01"
                min="0"
                value={draft.totalDeductions}
                disabled={disabled}
                onChange={(event) => onChange({ totalDeductions: event.target.value })}
                className={FIELD_CLASSES}
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Net (₪)
              <input
                type="number"
                step="0.01"
                min="0"
                value={draft.netPay}
                disabled={disabled}
                onChange={(event) => onChange({ netPay: event.target.value })}
                className={FIELD_CLASSES}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PayslipLeaveFields
              idPrefix={`${draft.id}-`}
              vacationDays={draft.vacationDays}
              sickDays={draft.sickDays}
              onVacationChange={(value) => onChange({ vacationDays: value })}
              onSickChange={(value) => onChange({ sickDays: value })}
              disabled={disabled}
              compact
            />
          </div>
        </>
      )}
    </article>
  );
}
