import Link from "next/link";
import { redirect } from "next/navigation";

import { getContext, homeFor } from "@/lib/auth/context";

export default async function Home() {
  const ctx = await getContext();
  if (ctx) {
    redirect(homeFor(ctx));
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between" dir="ltr">
      {/* Navbar */}
      <header className="w-full border-b border-slate-200/80 bg-white/85 backdrop-blur-md sticky top-0 z-20 transition">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-3 font-bold text-slate-900 text-base sm:text-lg hover:opacity-90 transition group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-600 to-indigo-500 text-white flex items-center justify-center font-extrabold text-base shadow-sm shadow-indigo-600/30 group-hover:scale-105 transition-transform">
              ₪
            </div>
            <span className="tracking-tight">
              Payroll<span className="text-indigo-600 font-extrabold">Portal</span>
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm font-semibold">
            <Link
              href="/login"
              className="text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition"
            >
              Sign In
            </Link>
            <Link
              href="/signup/bookkeeper"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl shadow-xs hover:shadow-sm shadow-indigo-600/20 transition flex items-center gap-1.5"
            >
              <span>Register Company</span>
              <span className="text-indigo-200 font-normal">→</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-3xl w-full text-center py-12">
          <div className="inline-flex items-center px-4 py-1 rounded-full bg-indigo-50 border border-indigo-100/80 text-indigo-700 text-xs font-bold tracking-wider uppercase mb-6">
            GET STARTED
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mb-4">
            Manage your businesses, <br className="hidden sm:inline" />
            <span className="text-indigo-600">payroll, and team invitations</span>
          </h1>

          <p className="max-w-2xl mx-auto text-slate-600 text-base sm:text-lg mb-10 leading-relaxed">
            Booking &amp; bookkeeping companies can register an account to create client businesses,
            upload pay slips, and generate secure role-based invitation links for employees and managers.
          </p>

          {/* Primary Action Card */}
          <div className="max-w-xl mx-auto space-y-4 text-left">
            <div className="p-8 rounded-2xl bg-white border-2 border-indigo-600 shadow-md">
              <div className="flex items-center gap-3.5 mb-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-2xl shrink-0 shadow-sm shadow-indigo-600/30">
                  🏢
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 leading-tight">
                    Booking / Bookkeeping Company
                  </h2>
                  <p className="text-xs font-semibold text-indigo-600 mt-0.5">
                    For Booking Firms &amp; Business Administrators
                  </p>
                </div>
              </div>

              <p className="text-sm text-slate-600 mb-5 leading-relaxed">
                Register your company account to start adding client businesses, publishing payroll, and sending invitation links to employees and managers.
              </p>

              {/* 3 Feature Pills with Green Checkmarks */}
              <div className="flex flex-wrap sm:flex-nowrap gap-2 sm:gap-2.5 mb-6 text-xs font-medium text-slate-700">
                <div className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 border border-slate-200 bg-white rounded-xl px-3 py-2 shadow-2xs">
                  <span className="text-emerald-500 font-bold text-sm">✓</span> Multi-Business
                </div>
                <div className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 border border-slate-200 bg-white rounded-xl px-3 py-2 shadow-2xs">
                  <span className="text-emerald-500 font-bold text-sm">✓</span> Smart PDF Parser
                </div>
                <div className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 border border-slate-200 bg-white rounded-xl px-3 py-2 shadow-2xs">
                  <span className="text-emerald-500 font-bold text-sm">✓</span> Staff Roster &amp; Invites
                </div>
              </div>

              <Link
                href="/signup/bookkeeper"
                className="inline-flex items-center justify-center w-full py-3.5 px-4 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition gap-2 shadow-sm"
              >
                <span>Register Company Account</span>
                <span>→</span>
              </Link>
            </div>

            {/* Worker Info Callout */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white/70 text-slate-600 text-xs flex items-start gap-3">
              <span className="text-lg">✉️</span>
              <div>
                <strong className="text-slate-800 font-semibold block mb-0.5">
                  Are you an Employee or Team Manager?
                </strong>
                <span>
                  Worker and manager accounts are invitation-only. Please open the unique invitation link provided by your company administrator to join your company.
                </span>
              </div>
            </div>
          </div>

          <p className="mt-8 text-sm text-slate-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-indigo-600 hover:text-indigo-700 underline underline-offset-4"
            >
              Sign in
            </Link>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>© {new Date().getFullYear()} SMB Payroll & Multi-Business Portal. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="/terms" className="hover:text-indigo-600 transition">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-indigo-600 transition">
              Privacy Policy
            </Link>
            <Link href="/signup/bookkeeper" className="hover:text-indigo-600 transition">
              Company Registration
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
