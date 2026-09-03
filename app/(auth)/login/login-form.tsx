"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn } from "@/lib/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const [state, submit, pending] = useActionState(signIn, null);
  const failed = state?.ok === false;
  const emailError = failed ? state.fieldErrors?.email?.[0] : undefined;
  const passwordError = failed ? state.fieldErrors?.password?.[0] : undefined;
  const formError = failed && !emailError && !passwordError ? state.error : undefined;

  return (
    <form action={submit} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}

      <div>
        <label
          htmlFor="email"
          className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
        >
          Work Email <span className="text-red-500">*</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? "email-error" : undefined}
          className={`w-full px-4 py-2.5 text-sm rounded-xl border ${
            emailError
              ? "border-red-400 bg-red-50/20 focus:ring-red-100"
              : "border-slate-300 bg-white focus:border-indigo-600 focus:ring-indigo-100"
          } focus:outline-none focus:ring-4 transition shadow-xs`}
          placeholder="you@company.co.il"
          disabled={pending}
        />
        {emailError && (
          <p id="email-error" className="text-xs font-medium text-red-600 mt-1.5 flex items-center gap-1">
            <span>•</span>
            <span>{emailError}</span>
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label
            htmlFor="password"
            className="block text-xs font-bold uppercase tracking-wider text-slate-700"
          >
            Password <span className="text-red-500">*</span>
          </label>
          <Link
            href="/forgot-password"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
          >
            Forgot password?
          </Link>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={passwordError ? "password-error" : undefined}
          className={`w-full px-4 py-2.5 text-sm rounded-xl border ${
            passwordError
              ? "border-red-400 bg-red-50/20 focus:ring-red-100"
              : "border-slate-300 bg-white focus:border-indigo-600 focus:ring-indigo-100"
          } focus:outline-none focus:ring-4 transition shadow-xs`}
          placeholder="••••••••"
          disabled={pending}
        />
        {passwordError && (
          <p id="password-error" className="text-xs font-medium text-red-600 mt-1.5 flex items-center gap-1">
            <span>•</span>
            <span>{passwordError}</span>
          </p>
        )}
      </div>

      {formError && (
        <div role="alert" className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium leading-relaxed">
          {formError}
        </div>
      )}

      <button
        type="submit"
        name="intent"
        value="password"
        disabled={pending}
        className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Signing in…</span>
          </>
        ) : (
          <span>Sign In</span>
        )}
      </button>

      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">or</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <button
        type="submit"
        name="intent"
        value="magic-link"
        disabled={pending}
        className="w-full py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition shadow-xs focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:opacity-50 cursor-pointer"
      >
        ✉️ Email me a sign-in link instead
      </button>

      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 leading-relaxed">
        💡 Employee &amp; manager accounts are created via invitation. If your email is not registered yet, contact your administrator.
      </div>
    </form>
  );
}
