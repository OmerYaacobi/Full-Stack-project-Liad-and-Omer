"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  cancelTeamJoinRequest,
  type TeamJoinRequest,
} from "@/lib/actions/employees";
import { formatIsoDate } from "@/lib/format";

export function OutgoingTeamJoinList({
  requests,
}: {
  requests: TeamJoinRequest[];
}) {
  if (requests.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-medium text-slate-900">Waiting for them to accept</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        They are not on your team until they say yes.
      </p>
      <ul className="mt-3 divide-y divide-slate-100">
        {requests.map((request) => (
          <OutgoingRow key={request.id} request={request} />
        ))}
      </ul>
    </div>
  );
}

function OutgoingRow({ request }: { request: TeamJoinRequest }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div>
        <p className="text-sm font-medium text-slate-900">{request.employeeName}</p>
        <p className="text-xs text-slate-500">
          Asked {formatIsoDate(request.createdAt.slice(0, 10))}
        </p>
        {error ? (
          <p role="alert" className="mt-1 text-sm text-red-600">
            {error}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const result = await cancelTeamJoinRequest(request.id);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.refresh();
          });
        }}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {pending ? "Cancelling…" : "Cancel ask"}
      </button>
    </li>
  );
}
