import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Check your email",
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="w-full max-w-md bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-3xl p-6 sm:p-10 shadow-xl shadow-slate-200/50 text-left transition-all">
      <div className="text-center mb-6">
        <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3 shadow-2xs">
          ✉️
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Check your email
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          {email ? (
            <>
              If <span className="font-semibold text-slate-800">{email}</span> is registered, a sign-in link is on its way.
            </>
          ) : (
            <>If that address is registered, a sign-in link is on its way.</>
          )}
        </p>
      </div>

      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 text-slate-600 text-xs leading-relaxed">
        The link works once and expires after an hour. You can close this tab and open the link on any device.
      </div>

      <div className="mt-6 border-t border-slate-100 pt-5 text-center">
        <Link
          href="/login"
          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition"
        >
          ← Use a different address
        </Link>
      </div>
    </div>
  );
}
