"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function WorkerSignupPage() {
  const [inviteToken, setInviteToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteToken.trim()) {
      setError("Please enter the invitation token or paste the invite link from your company.");
      return;
    }

    // If user pasted a full URL (e.g. https://.../invite/token123), extract the token
    const cleanToken = inviteToken.trim().split("/").pop() || "";
    router.push(`/invite/${cleanToken}`);
  };

  return (
    <div className="w-full max-w-xl bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-3xl p-6 sm:p-10 shadow-xl shadow-slate-200/50 text-left transition-all">
      {/* Header */}
      <div className="text-center mb-8">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold tracking-wider uppercase rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 mb-3">
          ✉️ Team Access
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
          Join Your Company
        </h1>
        <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
          Employee and Manager accounts are invitation-only to ensure secure payroll scoping.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-3 shadow-xs font-medium">
          <span className="text-base shrink-0">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleContinue} className="space-y-5">
        <div>
          <label htmlFor="inviteToken" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Invitation Code or Full Link
          </label>
          <input
            id="inviteToken"
            type="text"
            required
            value={inviteToken}
            onChange={(e) => {
              setInviteToken(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. paste your invite URL or token"
            className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-300 bg-white placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 focus:outline-none transition shadow-xs"
          />
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Your company administrator or bookkeeper can generate an invitation link for your account.
          </p>
        </div>

        <button
          type="submit"
          className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
        >
          <span>Continue with Invitation</span>
          <span className="font-normal text-emerald-200">→</span>
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
        <div>
          Are you a Bookkeeping Firm?{" "}
          <Link href="/signup/bookkeeper" className="text-indigo-600 font-bold hover:underline">
            Register Firm →
          </Link>
        </div>
        <Link href="/" className="text-slate-500 hover:underline">
          Return to Home
        </Link>
      </div>
    </div>
  );
}
