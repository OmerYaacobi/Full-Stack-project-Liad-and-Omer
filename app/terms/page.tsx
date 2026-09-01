import Link from "next/link";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between">
      {/* Header */}
      <header className="w-full border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-slate-900 hover:opacity-80 transition">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white text-base shadow-sm">
              📊
            </span>
            <span className="text-base tracking-tight">PayrollPortal</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/login"
              className="text-slate-600 hover:text-slate-900 font-medium px-3 py-1.5 rounded-lg hover:bg-slate-100 transition"
            >
              Sign In
            </Link>
            <Link
              href="/"
              className="bg-indigo-600 text-white font-semibold px-4 py-1.5 rounded-lg shadow-sm hover:bg-indigo-700 transition"
            >
              Home
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 w-full">
        <div className="bg-white rounded-2xl p-8 sm:p-12 shadow-sm border border-slate-200">
          <div className="border-b border-slate-100 pb-6 mb-8">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
              Legal Agreement
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-3 tracking-tight">
              Terms of Service
            </h1>
            <p className="text-sm text-slate-500 mt-2">
              Last updated: September 1, 2026 · Effective immediately
            </p>
          </div>

          <div className="prose prose-slate max-w-none space-y-8 text-sm leading-relaxed text-slate-600">
            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-2">1. Acceptance of Terms</h2>
              <p>
                By accessing or using the PayrollPortal platform (&quot;Service&quot;), whether as an accounting firm, business manager, or employee, you agree to be bound by these Terms of Service. If you are entering into this agreement on behalf of a company or accounting practice, you represent that you have the legal authority to bind that entity.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-2">2. Description of the Service</h2>
              <p>
                PayrollPortal provides a secure multi-tenant platform for payroll document distribution, employee self-service access to monthly payslips, digital Form 101/106 storage, and time-off request tracking. The platform operates as a secure intermediary and document management system; it does not replace official government filings or official tax payroll calculators.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-2">3. User Accounts and Role-Based Access</h2>
              <p>
                Access to the platform is structured around three distinct roles:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1.5">
                <li>
                  <strong className="text-slate-800">Bookkeeping Firms:</strong> Manage client companies, upload and allocate payroll documents, and administer employee records.
                </li>
                <li>
                  <strong className="text-slate-800">Managers:</strong> Oversee team member time-off requests, view team attendance calendars, and access shared documents.
                </li>
                <li>
                  <strong className="text-slate-800">Employees:</strong> Access personal monthly payslips, track leave balances, and upload tax documentation.
                </li>
              </ul>
              <p className="mt-2">
                Users are responsible for safeguarding their login credentials. Any unauthorized use or security breach must be reported immediately.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-2">4. Confidentiality and Data Integrity</h2>
              <p>
                Salary records, Israeli national identification numbers, and time-off records are strictly confidential. Our platform employs cryptographic tenant isolation and database Row Level Security (RLS) to ensure that employees cannot access peer salary data. Bookkeeping firms and employers are solely responsible for ensuring the accuracy of uploaded payroll files prior to publishing.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-2">5. Permitted Use &amp; Prohibitions</h2>
              <p>
                You agree not to:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1.5">
                <li>Attempt to bypass database authorization, inspect network tokens, or access unauthorized tenant spaces.</li>
                <li>Upload malicious files, corrupted PDFs, or scripts disguised as employment documents.</li>
                <li>Share invitation tokens or accounts across multiple individuals.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-2">6. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by applicable law, PayrollPortal and its developers shall not be liable for indirect, incidental, or consequential damages resulting from errors in source payroll files supplied by third-party accounting systems or delays in employer review of leave requests.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-2">7. Modifications to Terms</h2>
              <p>
                We reserve the right to modify these terms at any time. Continued use of the portal after modifications constitutes acceptance of the revised terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-2">8. Contact &amp; Support</h2>
              <p>
                If you have any questions regarding these Terms of Service, please contact your company administrator or our support team via the portal help desk.
              </p>
            </section>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-100 flex items-center justify-between">
            <Link
              href="/privacy"
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 underline"
            >
              Read our Privacy Policy →
            </Link>
            <Link
              href="/"
              className="text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} PayrollPortal. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-slate-800 font-medium">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-slate-800 font-medium">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

