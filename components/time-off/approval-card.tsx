"use client";

import { useState, useTransition } from "react";

import {
  approveTimeOffRequest,
  rejectTimeOffRequest,
  type PendingApproval,
} from "@/lib/actions/time-off";
import { RequestStatusBadge } from "@/components/time-off/status-badge";
import { TimeOffAttachmentLink } from "@/components/time-off/attachment-link";
import { formatDateRange, formatDays } from "@/lib/format";

export function ApprovalCard({ request }: { request: PendingApproval }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "Could not save that decision.");
    });
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">
            {request.employeeName ?? "Employee"} · {request.leaveTypeName}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {formatDateRange(request.startDate, request.endDate)} ·{" "}
            {formatDays(request.workingDays)}
            {request.remainingAfter !== null
              ? ` · ${formatDays(request.remainingAfter)} left if you approve`
              : ""}
          </p>
          {request.reason ? (
            <p className="mt-2 text-sm text-slate-700">{request.reason}</p>
          ) : null}
          {request.attachments.length > 0 ? (
            <p className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
              {request.attachments.map((file) => (
                <TimeOffAttachmentLink
                  key={file.id}
                  attachmentId={file.id}
                  title={file.title}
                />
              ))}
            </p>
          ) : null}
        </div>
        <RequestStatusBadge status={request.status} />
      </div>

      {request.overlaps.length > 0 ? (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs font-medium text-amber-900">
            Someone else on the team is already away on these dates
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-amber-800">
            {request.overlaps.map((overlap, index) => (
              <li key={`${overlap.employeeName}-${overlap.startDate}-${index}`}>
                {overlap.employeeName} · {formatDateRange(overlap.startDate, overlap.endDate)}{" "}
                ({overlap.status})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {rejecting ? (
        <div className="mt-3">
          <label htmlFor={`reject-note-${request.id}`} className="block text-sm font-medium text-slate-700">
            Why are you rejecting this?
          </label>
          <textarea
            id={`reject-note-${request.id}`}
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={pending}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
          />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => approveTimeOffRequest(request.id))}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {pending && !rejecting ? "Approving…" : "Approve"}
        </button>
        {rejecting ? (
          <button
            type="button"
            disabled={pending || note.trim().length === 0}
            onClick={() => run(() => rejectTimeOffRequest(request.id, note.trim()))}
            className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-60"
          >
            {pending ? "Rejecting…" : "Confirm rejection"}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => setRejecting(true)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Reject
          </button>
        )}
      </div>
    </article>
  );
}
