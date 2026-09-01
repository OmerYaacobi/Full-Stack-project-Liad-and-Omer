import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between">
      {/* Header */}
      <header className="w-full border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-slate-900 hover:opacity-80 transition">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white text-base shadow-sm">
              🔒
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
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
              Data Protection &amp; Privacy
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-3 tracking-tight">
              Privacy Policy
            </h1>
            <p className="text-sm text-slate-500 mt-2">
              Last updated: September 1, 2026 · Built with Zero-Trust Security
            </p>
          </div>

          <div className="prose prose-slate max-w-none space-y-8 text-sm leading-relaxed text-slate-600">
            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-2">1. Overview &amp; Commitment</h2>
              <p>
                At PayrollPortal, data confidentiality is the core foundational principle of our system. Because payroll and tax documents contain highly sensitive personal and financial information, our architecture enforces strict data isolation and privacy protection at every layer of the technology stack.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-2">2. Information We Collect</h2>
              <p>We process the following categories of data solely on behalf of employers and accounting firms:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1.5">
                <li>
                  <strong className="text-slate-800">Identity &amp; Account Information:</strong> Full name, verified email address, and hashed authentication credentials.
                </li>
                <li>
                  <strong className="text-slate-800">Employment &amp; Payroll Records:</strong> Israeli National ID numbers, internal employee IDs, job titles, start dates, and monthly payslips (gross pay, deductions, net salary).
                </li>
                <li>
                  <strong className="text-slate-800">Absence &amp; Leave Records:</strong> Vacation and sick day requests, remaining entitlement balances, medical certificates, and approval statuses.
                </li>
                <li>
                  <strong className="text-slate-800">Tax &amp; Compliance Documents:</strong> Digital Form 101 submissions, Form 106 annual summaries, pension notifications, and employment contracts.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-2">3. How Your Data Is Secured</h2>
              <p>
                Our infrastructure incorporates rigorous multi-layered defense mechanisms:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1.5">
                <li>
                  <strong className="text-slate-800">Postgres Row-Level Security (RLS):</strong> Every database query is cryptographically bound to the authenticated user ID (`auth.uid()`). No employee can query or retrieve data belonging to another colleague.
                </li>
                <li>
                  <strong className="text-slate-800">Private Storage &amp; Short-Lived Signed URLs:</strong> Document files are stored in private cloud buckets. Files cannot be accessed directly via static URLs; access requires a temporary cryptographically signed token valid for only 120 seconds.
                </li>
                <li>
                  <strong className="text-slate-800">Server-Side Redaction:</strong> Financial insights and aggregation metrics are calculated inside secure server components and are never exposed across tenant boundaries.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-2">4. Data Sharing &amp; Non-Disclosure</h2>
              <p>
                We do not sell, rent, or monetize your personal data under any circumstances. Information is accessible only to:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1.5">
                <li>Your authorized bookkeeping firm and payroll administrator.</li>
                <li>Your direct managers (solely for documents explicitly flagged with manager visibility and leave requests).</li>
                <li>Your own authenticated employee account.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-2">5. Data Retention &amp; Deletion</h2>
              <p>
                Payroll records are retained according to statutory Israeli labor and tax record-keeping regulations. Upon termination of employment, historic payslip access is preserved or archived according to company policies.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-2">6. Your Privacy Rights</h2>
              <p>
                Under applicable privacy laws, you have the right to access your personal data, download copies of all submitted documents, verify salary calculation components, and request corrections to biographical data via your employer or bookkeeping administrator.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-2">7. Inquiries &amp; Privacy Officer</h2>
              <p>
                For security inquiries, audit log requests, or data privacy questions, please contact your accounting office administrator or submit a request through the portal security desk.
              </p>
            </section>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-100 flex items-center justify-between">
            <Link
              href="/terms"
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 underline"
            >
              ← Read our Terms of Service
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

