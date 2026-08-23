"use client";

import { useState, useTransition } from "react";

import { cancelTimeOffRequest, type TimeOffRequest } from "@/lib/actions/time-off";
import { TimeOffAttachmentLink } from "@/components/time-off/attachment-link";
import { RequestStatusBadge } from "@/components/time-off/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDateRange, formatDays, formatIsoDate } from "@/lib/format";

export function TimeOffRequestList({
  requests,
}: {
  requests: TimeOffRequest[];
}) {
  if (requests.length === 0) {
    return (
      <EmptyState
        title="No requests yet"
        description="When you submit a request it appears here, with a cancel button while it is still pending."
      />
    );
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
      {requests.map((request) => (
        <li key={request.id} className="flex items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900">
              {request.leaveTypeName} · {formatDateRange(request.startDate, request.endDate)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {formatDays(request.workingDays)}
              {request.reason ? ` · ${request.reason}` : ""}
              {request.status !== "pending" && request.decidedAt
                ? ` · Decided ${formatIsoDate(request.decidedAt.slice(0, 10))}`
                : ""}
              {request.decisionNote ? ` · ${request.decisionNote}` : ""}
            </p>
            {request.attachments.length > 0 ? (
              <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
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
          <div className="flex shrink-0 items-center gap-2">
            <RequestStatusBadge status={request.status} />
            {request.status === "pending" ? (
              <CancelButton requestId={request.id} />
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function CancelButton({ requestId }: { requestId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const result = await cancelTimeOffRequest(requestId);
            if (!result.ok) setError(result.error);
          });
        }}
        className="text-xs font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline disabled:opacity-60"
      >
        {pending ? "Cancelling…" : "Cancel"}
      </button>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
