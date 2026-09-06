import type { Metadata } from "next";

import { requireContext } from "@/lib/auth/context";

export const metadata: Metadata = {
  title: "No access yet",
};

export default async function NoAccessPage() {
  const ctx = await requireContext();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-4 py-12 relative selection:bg-indigo-500 selection:text-white" dir="ltr">
      {/* Subtle background decorative orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-3xl p-6 sm:p-10 shadow-xl shadow-slate-200/50 text-left transition-all">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-amber-50 border border-amber-200 text-amber-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3 shadow-2xs">
            🏢
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold tracking-wider uppercase rounded-full bg-amber-50 text-amber-700 border border-amber-100 mb-2">
            No Workspace Attached
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Account Not Assigned
          </h1>
        </div>

        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
          You are signed in as <span className="font-semibold text-slate-900">{ctx.email}</span>, but your account is not currently attached to any active company or firm.
        </p>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 text-slate-600 text-xs leading-relaxed mb-6">
          Please ask your employer or bookkeeping firm administrator to send you an invitation link to join their organization.
        </div>

        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="w-full py-3 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm shadow-2xs transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </form>
      </div>
    </div>
  );
}
