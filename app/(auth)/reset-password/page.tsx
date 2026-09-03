"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updateUserPassword } from "@/lib/actions/auth";

export default function ResetPasswordPage() {
  const [state, submit, pending] = useActionState(updateUserPassword, null);

  const failed = state?.ok === false;
  const passwordError = failed ? state.fieldErrors?.password?.[0] : undefined;
  const confirmPasswordError = failed
    ? state.fieldErrors?.confirmPassword?.[0]
    : undefined;
  const formError =
    failed && !passwordError && !confirmPasswordError ? state.error : undefined;

  return (
    <div className="w-full max-w-md bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-3xl p-6 sm:p-10 shadow-xl shadow-slate-200/50 text-left transition-all">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3 shadow-2xs">
          🔒
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold tracking-wider uppercase rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 mb-2">
          Verified Session
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Set New Password
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Enter your new credentials below to restore access.
        </p>
      </div>

      <form action={submit} className="space-y-4">
        <div>
          <label
            htmlFor="password"
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            New Password <span className="text-red-500">*</span>
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            placeholder="At least 6 characters"
            disabled={pending}
            className={`w-full px-4 py-2.5 text-sm rounded-xl border ${
              passwordError
                ? "border-red-400 bg-red-50/20 focus:ring-red-100"
                : "border-slate-300 bg-white focus:border-indigo-600 focus:ring-indigo-100"
            } focus:outline-none focus:ring-4 transition shadow-xs`}
          />
          {passwordError && (
            <p className="text-xs font-medium text-red-600 mt-1.5 flex items-center gap-1">
              <span>•</span>
              <span>{passwordError}</span>
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Confirm New Password <span className="text-red-500">*</span>
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            placeholder="Re-enter your new password"
            disabled={pending}
            className={`w-full px-4 py-2.5 text-sm rounded-xl border ${
              confirmPasswordError
                ? "border-red-400 bg-red-50/20 focus:ring-red-100"
                : "border-slate-300 bg-white focus:border-indigo-600 focus:ring-indigo-100"
            } focus:outline-none focus:ring-4 transition shadow-xs`}
          />
          {confirmPasswordError && (
            <p className="text-xs font-medium text-red-600 mt-1.5 flex items-center gap-1">
              <span>•</span>
              <span>{confirmPasswordError}</span>
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
          disabled={pending}
          className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {pending ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Updating Password…</span>
            </>
          ) : (
            <span>Update Password & Sign In →</span>
          )}
        </button>
      </form>

      <p className="mt-6 border-t border-slate-100 pt-5 text-center text-xs text-slate-500">
        Changed your mind?{" "}
        <Link
          href="/login"
          className="font-bold text-indigo-600 hover:text-indigo-800 transition"
        >
          Back to Sign In →
        </Link>
      </p>
    </div>
  );
}

