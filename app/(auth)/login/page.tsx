import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in | Payroll Portal",
};

const CALLBACK_ERRORS: Record<string, string> = {
  invalid_link: "That sign-in link has expired or was already used.",
  missing_code: "That sign-in link was incomplete. Request a new one.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <div className="w-full max-w-md bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-3xl p-6 sm:p-10 shadow-xl shadow-slate-200/50 text-left transition-all">
      {/* Header */}
      <div className="text-center mb-6">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold tracking-wider uppercase rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 mb-3">
          🔒 Secure Sign In
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Welcome Back
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Sign in to access your payroll dashboard and records.
        </p>
      </div>

      {error && CALLBACK_ERRORS[error] && (
        <div
          role="alert"
          className="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium leading-relaxed shadow-xs flex items-center gap-2"
        >
          <span>⚠️</span>
          <span>{CALLBACK_ERRORS[error]}</span>
        </div>
      )}

      <LoginForm next={next} />

      <p className="mt-6 border-t border-slate-100 pt-5 text-center text-xs text-slate-500">
        Do not have an account yet?{" "}
        <Link
          href="/signup"
          className="font-bold text-indigo-600 hover:text-indigo-800 transition"
        >
          Create account →
        </Link>
      </p>
    </div>
  );
}
