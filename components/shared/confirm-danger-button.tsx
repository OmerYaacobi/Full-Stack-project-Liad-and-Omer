"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ActionResult } from "@/lib/actions/result";

export function ConfirmDangerButton({
  label,
  confirmTitle,
  confirmBody,
  confirmLabel,
  requireText,
  requireLabel,
  onConfirm,
  redirectTo,
  onSuccess,
}: {
  label: string;
  confirmTitle: string;
  confirmBody: string;
  confirmLabel: string;
  requireText?: string;
  requireLabel?: string;
  onConfirm: () => Promise<ActionResult<void>>;
  redirectTo?: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const typedOk = !requireText || typed.trim() === requireText;

  function run() {
    if (!typedOk) return;
    setError(null);
    start(async () => {
      const result = await onConfirm();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setTyped("");
      onSuccess?.();
      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          {label}
        </button>
      ) : (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-950">{confirmTitle}</p>
          <p className="mt-1 text-sm text-red-900">{confirmBody}</p>
          {requireText ? (
            <label className="mt-3 block text-xs font-medium text-red-900">
              {requireLabel ?? `Type ${requireText} to confirm`}
              <input
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                disabled={pending}
                className="mt-1 block w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-red-700 focus:ring-1 focus:ring-red-700"
              />
            </label>
          ) : null}
          {error ? (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || !typedOk}
              onClick={run}
              className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
            >
              {pending ? "Removing…" : confirmLabel}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                setTyped("");
                setError(null);
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
