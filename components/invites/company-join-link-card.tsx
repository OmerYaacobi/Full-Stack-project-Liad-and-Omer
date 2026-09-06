"use client";

import { useEffect, useState, useTransition } from "react";

import type { CompanyJoinLink } from "@/lib/actions/invitations";
import { formatIsoDate } from "@/lib/format";

export function CompanyJoinLinkCard({
  companyName,
  employee,
  manager,
  error,
  onRotate,
}: {
  companyName: string;
  employee: CompanyJoinLink | null;
  manager: CompanyJoinLink | null;
  error?: string | null;
  onRotate?: (role: "employee" | "manager") => Promise<void>;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-medium text-slate-900">Team join links</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Send the employee link to people who should join as employees, and the
        manager link only to people who should be managers. Each person fills in
        their own details. A person with the employee link cannot join as a
        manager.
      </p>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <JoinLinkRow
            label="Employees"
            hint={`Send this to the ${companyName} team`}
            link={employee}
            onRotate={onRotate ? () => onRotate("employee") : undefined}
          />
          <JoinLinkRow
            label="Managers"
            hint="Send this only to people who should manage a team"
            link={manager}
            onRotate={onRotate ? () => onRotate("manager") : undefined}
          />
        </div>
      )}
    </div>
  );
}

function JoinLinkRow({
  label,
  hint,
  link,
  onRotate,
}: {
  label: string;
  hint: string;
  link: CompanyJoinLink | null;
  onRotate?: () => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const fullUrl = link
    ? link.inviteUrl.startsWith("http")
      ? link.inviteUrl
      : origin
        ? `${origin}${link.inviteUrl}`
        : link.inviteUrl
    : null;

  async function copy() {
    if (!fullUrl) return;
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <p className="text-sm font-medium text-slate-900">{label}</p>
      <p className="text-xs text-slate-500">{hint}</p>
      {fullUrl ? (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={fullUrl}
            className="min-w-0 flex-1 rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 font-mono text-xs text-slate-700"
          />
          <button
            type="button"
            onClick={() => void copy()}
            className="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">No link yet.</p>
      )}
      {link?.expiresAt ? (
        <p className="mt-1 text-xs text-slate-500">
          Expires {formatIsoDate(link.expiresAt.slice(0, 10))}.
        </p>
      ) : null}
      {rotateError ? (
        <p role="alert" className="mt-1 text-sm text-red-600">
          {rotateError}
        </p>
      ) : null}
      {onRotate ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setRotateError(null);
            start(async () => {
              try {
                await onRotate();
              } catch (err) {
                setRotateError(
                  err instanceof Error ? err.message : "Could not make a new link.",
                );
              }
            });
          }}
          className="mt-1 text-xs font-medium text-slate-600 underline-offset-2 hover:underline disabled:opacity-60"
        >
          {pending ? "Making a new link…" : "Make a new link"}
        </button>
      ) : null}
    </div>
  );
}
