import type { ReactNode } from "react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between relative selection:bg-indigo-500 selection:text-white" dir="ltr">
      {/* Subtle Background Accent Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/4 w-96 h-96 bg-purple-200/30 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="w-full border-b border-slate-200/80 bg-white/85 backdrop-blur-md sticky top-0 z-20 transition shadow-xs">
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
              href="/signup"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl shadow-xs hover:shadow-sm shadow-indigo-600/20 transition flex items-center gap-1.5"
            >
              <span>Get Started</span>
              <span className="text-indigo-200 font-normal">→</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Form Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8 relative z-10">
        {children}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200/80 bg-white/70 backdrop-blur-sm py-4 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="font-medium">
            © {new Date().getFullYear()} Payroll &amp; Bookkeeping Portal. All rights reserved.
          </span>
          <div className="flex items-center gap-5 text-slate-500 font-medium">
            <Link href="/" className="hover:text-slate-800 transition">
              Home
            </Link>
            <Link href="/privacy" className="hover:text-slate-800 transition">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-slate-800 transition">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
