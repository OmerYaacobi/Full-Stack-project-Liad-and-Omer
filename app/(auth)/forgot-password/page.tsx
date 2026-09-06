"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordResetEmail } from "@/lib/actions/auth";

export default function ForgotPasswordPage() {
  const [state, submit, pending] = useActionState(
    requestPasswordResetEmail,
    null,
  );

  const failed = state?.ok === false;
  const fieldError = failed ? state.fieldErrors?.email?.[0] : undefined;
  const formError = failed && !fieldError ? state.error : undefined;

  return (
    <div className="w-full max-w-md bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-3xl p-6 sm:p-10 shadow-xl shadow-slate-200/50 text-left transition-all">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3 shadow-2xs">
          🔑
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold tracking-wider uppercase rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 mb-2">
          Account Recovery
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Forgot Password?
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Enter your registered email address and we will send you a secure link to reset your password.
        </p>
      </div>

      {state?.ok ? (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs leading-relaxed flex items-start gap-2.5">
            <span className="text-base shrink-0">✓</span>
            <div>
              <strong className="font-bold block mb-0.5">Password reset link sent!</strong>
              <span>
                We have sent a recovery email to{" "}
                <span className="font-bold text-emerald-950">
                  {state.data.email}
                </span>
                . Check your inbox (or spam folder) and click the link to set a new password.
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <a
              href="https://mail.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs text-center transition flex items-center justify-center gap-2"
            >
              <span>Open Gmail</span>
              <span>↗</span>
            </a>
            <Link
              href="/login"
              className="w-full py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs text-center transition"
            >
              Return to Sign In
            </Link>
          </div>
        </div>
      ) : (
        <form action={submit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
            >
              Work / Registered Email <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              autoFocus
              placeholder="you@company.co.il"
              disabled={pending}
              className={`w-full px-4 py-2.5 text-sm rounded-xl border ${
                fieldError
                  ? "border-red-400 bg-red-50/20 focus:ring-red-100"
                  : "border-slate-300 bg-white focus:border-indigo-600 focus:ring-indigo-100"
              } focus:outline-none focus:ring-4 transition shadow-xs`}
            />
            {fieldError && (
              <p className="text-xs font-medium text-red-600 mt-1.5 flex items-center gap-1">
                <span>•</span>
                <span>{fieldError}</span>
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
                <span>Sending Reset Link…</span>
              </>
            ) : (
              <span>Send Reset Link →</span>
            )}
          </button>
        </form>
      )}

      {/* Footer Navigation */}
      <p className="mt-6 border-t border-slate-100 pt-5 text-center text-xs text-slate-500">
        Remembered your password?{" "}
        <Link
          href="/login"
          className="font-bold text-indigo-600 hover:text-indigo-800 transition"
        >
          Sign in here →
        </Link>
      </p>
    </div>
  );
}
