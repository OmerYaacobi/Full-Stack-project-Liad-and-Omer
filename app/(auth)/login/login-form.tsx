"use client";

import { useActionState } from "react";

import { signIn } from "@/lib/actions/auth";

const FIELD_CLASSES =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50";

export function LoginForm({ next }: { next?: string }) {
  const [state, submit, pending] = useActionState(signIn, null);
  const failed = state?.ok === false;
  const emailError = failed ? state.fieldErrors?.email?.[0] : undefined;
  const passwordError = failed ? state.fieldErrors?.password?.[0] : undefined;
  const formError = failed && !emailError && !passwordError ? state.error : undefined;

  return (
    <form action={submit} className="mt-6 space-y-4">
      {next && <input type="hidden" name="next" value={next} />}

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-slate-700"
        >
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? "email-error" : undefined}
          className={FIELD_CLASSES}
          placeholder="you@company.co.il"
          disabled={pending}
        />
        {emailError && (
          <p id="email-error" className="mt-1 text-sm text-red-600">
            {emailError}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-slate-700"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={passwordError ? "password-error" : undefined}
          className={FIELD_CLASSES}
          placeholder="••••••••"
          disabled={pending}
        />
        {passwordError && (
          <p id="password-error" className="mt-1 text-sm text-red-600">
            {passwordError}
          </p>
        )}
      </div>

      {formError && (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      )}

      <button
        type="submit"
        name="intent"
        value="password"
        disabled={pending}
        className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-xs uppercase tracking-wide text-slate-400">or</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <button
        type="submit"
        name="intent"
        value="magic-link"
        disabled={pending}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:opacity-60"
      >
        Email me a sign-in link instead
      </button>

      <p className="text-xs text-slate-500">
        Employee and manager accounts are created from an invitation link. If
        your address is not registered yet, ask your bookkeeper to invite you.
      </p>
    </form>
  );
}
