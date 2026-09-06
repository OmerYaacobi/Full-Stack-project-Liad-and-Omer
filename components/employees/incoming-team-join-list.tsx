"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  decideTeamJoin,
  type TeamJoinRequest,
} from "@/lib/actions/employees";
import { formatIsoDate } from "@/lib/format";

export function IncomingTeamJoinList({
  requests,
}: {
  requests: TeamJoinRequest[];
}) {
  if (requests.length === 0) return null;

  return (
    <section className="mb-8 space-y-3">
      <h2 className="text-sm font-medium text-slate-900">Team invites</h2>
      {requests.map((request) => (
        <IncomingTeamJoinCard key={request.id} request={request} />
      ))}
    </section>
  );
}

function IncomingTeamJoinCard({ request }: { request: TeamJoinRequest }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<"accept" | "decline" | null>(null);

  function decide(approve: boolean) {
    setError(null);
    setAction(approve ? "accept" : "decline");
    start(async () => {
      const result = await decideTeamJoin(request.id, approve);
      if (!result.ok) {
        setError(result.error);
        setAction(null);
        return;
      }
      router.refresh();
    });
  }

  return (
    <article className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-medium text-slate-900">
        {request.managerName} asked you to join their team
      </p>
      <p className="mt-0.5 text-xs text-slate-600">
        {request.managerJobTitle ? `${request.managerJobTitle} · ` : ""}
        Asked {formatIsoDate(request.createdAt.slice(0, 10))}. They become your
        line manager for time off. If you already report to someone else,
        accepting replaces them.
      </p>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => decide(true)}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {pending && action === "accept" ? "Accepting…" : "Accept"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => decide(false)}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {pending && action === "decline" ? "Declining…" : "Decline"}
        </button>
      </div>
    </article>
  );
}
