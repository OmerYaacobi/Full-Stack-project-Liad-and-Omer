"use client";

import { useState, useTransition } from "react";

export function ManagerShareToggle({
  shared,
  onToggle,
}: {
  shared: boolean;
  onToggle: (next: boolean) => Promise<{ ok: boolean }>;
}) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(shared);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const next = !value;
          setError(null);
          startTransition(async () => {
            const result = await onToggle(next);
            if (!result.ok) {
              setError("Could not update sharing.");
              return;
            }
            setValue(next);
          });
        }}
        className={
          value
            ? "rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700"
            : "rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
        }
      >
        {pending ? "…" : value ? "Shared with managers" : "Share with managers"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
