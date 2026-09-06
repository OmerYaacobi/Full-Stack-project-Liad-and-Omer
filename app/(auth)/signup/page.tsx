import Link from "next/link";

export default function SignupHubPage() {
  return (
    <div className="w-full max-w-xl bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-10 shadow-xl shadow-slate-200/50 text-left transition-all">
      {/* Header */}
      <div className="text-center mb-8">
        <span className="inline-flex items-center px-4 py-1 text-[11px] font-bold tracking-wider uppercase rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100/80 mb-3">
          GET STARTED
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
        <div className="border-2 border-indigo-600 bg-white rounded-2xl p-6 sm:p-7 shadow-xs">
          <div className="flex items-center gap-3.5 mb-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-2xl shrink-0 shadow-sm shadow-indigo-600/30">
              🏢
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">
                Company / Bookkeeper Account
              </h2>
              <p className="text-xs font-semibold text-indigo-600 mt-0.5">
                For Booking Firms &amp; Business Administrators
              </p>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-5">
            Create an organization account to manage multiple businesses, upload and batch-process digital payslips, generate secure invites for workers, and publish payroll periods.
          </p>

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
            className="flex items-center justify-center w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition-all shadow-xs gap-2 cursor-pointer"
          >
            Register Organization Account →
          </Link>
        </div>

        {/* Worker & Manager Notice Card */}
        <div className="border border-slate-200/80 bg-slate-50/50 rounded-2xl p-5 sm:p-6">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200/60 text-slate-600 flex items-center justify-center text-lg shrink-0">
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
                className="inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-700 underline underline-offset-2 transition"
              >
                Have an invitation code or URL? Enter it here →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
