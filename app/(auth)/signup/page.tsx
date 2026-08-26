import Link from "next/link";

export default function SignupHubPage() {
  return (
    <div className="w-full max-w-2xl bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-3xl p-6 sm:p-10 shadow-xl shadow-slate-200/50 text-left transition-all">
      {/* Header */}
      <div className="text-center mb-8">
        <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold tracking-wider uppercase rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 mb-3">
          Get Started
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
          Join the Payroll Portal
        </h1>
        <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
          Select your registration type below to set up your organization or join an existing business.
        </p>
      </div>

      <div className="space-y-4">
        {/* Company Registration Card */}
        <div className="group relative p-6 sm:p-7 border-2 border-indigo-600/90 bg-gradient-to-br from-indigo-50/70 via-white to-indigo-50/30 rounded-2xl shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-2xl shadow-sm shadow-indigo-600/30">
                🏢
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Company / Bookkeeper Account
                </h2>
                <p className="text-xs font-semibold text-indigo-700">
                  For Booking Firms &amp; Business Administrators
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-5">
            Create an organization account to manage multiple businesses, upload and batch-process digital payslips, generate secure invites for workers, and publish payroll periods.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5 text-[11px] font-semibold text-slate-600">
            <div className="flex items-center gap-1.5 bg-white/80 border border-slate-200/70 rounded-lg px-2.5 py-1.5">
              <span className="text-emerald-600">✓</span> Multi-Business
            </div>
            <div className="flex items-center gap-1.5 bg-white/80 border border-slate-200/70 rounded-lg px-2.5 py-1.5">
              <span className="text-emerald-600">✓</span> Smart PDF Parser
            </div>
            <div className="flex items-center gap-1.5 bg-white/80 border border-slate-200/70 rounded-lg px-2.5 py-1.5">
              <span className="text-emerald-600">✓</span> Staff Roster &amp; Invites
            </div>
          </div>

          <Link
            href="/signup/bookkeeper"
            className="inline-flex items-center justify-center w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all shadow-sm hover:shadow shadow-indigo-600/20 gap-2 cursor-pointer"
          >
            <span>Register Organization Account</span>
            <span className="font-normal text-indigo-200">→</span>
          </Link>
        </div>

        {/* Worker & Manager Notice Card */}
        <div className="p-5 sm:p-6 border border-slate-200 bg-slate-50/70 hover:bg-slate-50 rounded-2xl transition">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-slate-200/80 text-slate-700 flex items-center justify-center text-xl shrink-0">
              ✉️
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                Are you an Employee or Team Manager?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                Worker and manager accounts are securely tied to your employer. Use the <strong>invitation link</strong> provided by your company administrator to sign up.
              </p>
              <Link
                href="/signup/worker"
                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition underline underline-offset-2"
              >
                Have an invitation code or URL? Enter it here →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Sign-in Link */}
      <p className="mt-8 pt-6 border-t border-slate-100 text-center text-xs text-slate-500">
        Already have an account?{" "}
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
