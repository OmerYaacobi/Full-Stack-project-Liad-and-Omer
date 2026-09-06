"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getInvitationDetails } from "@/lib/actions/invitations";
import { inviteSignupSchema, type InviteSignupInput } from "@/lib/validations/auth";

export default function InviteSignupPage() {
  const params = useParams();
  const token = params?.token as string;

  const [invitationInfo, setInvitationInfo] = useState<{
    companyName: string;
    role: "employee" | "manager";
    email?: string | null;
  } | null>(null);

  const [loadingInvite, setLoadingInvite] = useState(true);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Omit<InviteSignupInput, "token">>({
    fullName: "",
    nationalId: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    jobTitle: "",
    department: "",
    role: "employee",
    terms: false,
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function loadInvite() {
      if (!token) return;
      setLoadingInvite(true);
      const res = await getInvitationDetails(token);
      if (!res.ok || !res.data || (res.data.role !== "employee" && res.data.role !== "manager")) {
        setInviteError(res.error || "Invalid invitation link");
      } else {
        const role = res.data.role;
        setInvitationInfo({
          companyName: res.data.companyName,
          role,
          email: res.data.email,
        });
        setFormData((prev) => ({
          ...prev,
          email: res.data.email || prev.email,
          role,
        }));
      }
      setLoadingInvite(false);
    }
    loadInvite();
  }, [token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});

    const validationResult = inviteSignupSchema.safeParse({
      ...formData,
      role: invitationInfo?.role ?? formData.role,
      token,
    });

    if (!validationResult.success) {
      const formattedErrors: Record<string, string> = {};
      for (const issue of validationResult.error.issues) {
        const path = issue.path[0] as string;
        if (path && !formattedErrors[path]) {
          formattedErrors[path] = issue.message;
        }
      }
      setFieldErrors(formattedErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName.trim(),
            national_id: formData.nationalId.trim(),
            phone: formData.phone?.trim() || null,
            job_title: formData.jobTitle?.trim() || null,
            department: formData.department?.trim() || null,
            invitation_token: token,
            signup_type: "worker",
          },
        },
      });

      if (error) {
        setGeneralError(
          error.message === "User already registered"
            ? "This email already has an account. Employee access needs its own email — sign in with that account, or register the invite with a different address."
            : `Registration error: ${error.message}`,
        );
        return;
      }

      if (data?.user) {
        setIsSuccess(true);
      }
    } catch (err: unknown) {
      setGeneralError("An unexpected error occurred during signup. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingInvite) {
    return (
      <div className="w-full max-w-lg bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-3xl p-10 shadow-xl shadow-slate-200/50 text-center">
        <div className="animate-spin h-8 w-8 text-indigo-600 mx-auto mb-4 border-4 border-indigo-600 border-t-transparent rounded-full" />
        <p className="text-slate-700 font-bold text-sm">Validating invitation link...</p>
        <p className="text-slate-400 text-xs mt-1">Please wait a moment.</p>
      </div>
    );
  }

  if (inviteError || !invitationInfo) {
    return (
      <div className="w-full max-w-lg bg-white/95 backdrop-blur-sm border border-red-200/80 rounded-3xl p-8 sm:p-10 shadow-xl shadow-slate-200/50 text-center">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-sm shadow-red-500/20">
          ✕
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Invalid Invitation</h2>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          {inviteError || "This invitation link is invalid or has expired. Please ask your administrator for a new invite link."}
        </p>
        <Link
          href="/"
          className="inline-flex justify-center items-center px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition text-sm shadow-xs"
        >
          Return to Home
        </Link>
      </div>
    );
  }

  const isManager = invitationInfo.role === "manager";

  if (isSuccess) {
    return (
      <div className="w-full max-w-lg bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-3xl p-8 sm:p-10 shadow-xl shadow-slate-200/50 text-center">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-sm shadow-emerald-500/20">
          ✓
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 mb-2">
          Welcome to {invitationInfo.companyName}!
        </h2>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          Your account has been created with the role of{" "}
          <strong className="text-slate-900 font-bold">
            {isManager ? "Team Manager" : "Employee"}
          </strong>.
          <br className="my-2" />
          A verification link has been sent to{" "}
          <span className="font-semibold text-slate-900">{formData.email}</span>.
        </p>
        <Link
          href="/login"
          className="inline-flex justify-center items-center px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-sm text-sm"
        >
          Sign In to Your Account →
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-3xl p-6 sm:p-10 shadow-xl shadow-slate-200/50 text-left transition-all">
      {/* Header with Invited Business & Role badge */}
      <div className="border-b border-slate-100 pb-5 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold tracking-wider uppercase rounded-full border ${
            isManager
              ? "bg-amber-50 text-amber-800 border-amber-200/80"
              : "bg-emerald-50 text-emerald-800 border-emerald-200/80"
          }`}>
            <span>{isManager ? "👔" : "👤"}</span>
            <span>{isManager ? "Manager Invitation" : "Employee Invitation"}</span>
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Join {invitationInfo.companyName}
        </h1>
        <p className="text-slate-500 text-xs sm:text-sm mt-1">
          Activate your {isManager ? "team manager" : "employee"} account to view your payslips and employment records.
        </p>
      </div>

      {generalError && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3 shadow-xs">
          <span className="text-lg shrink-0">⚠️</span>
          <div className="flex-1 font-medium leading-relaxed">{generalError}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {/* Section 1: Personal Details */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px]">
              1
            </span>
            <span>Personal Information</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="fullName" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                value={formData.fullName}
                onChange={handleChange}
                placeholder="e.g. Jane Doe"
                className={`w-full px-4 py-2.5 text-sm rounded-xl border ${
                  fieldErrors.fullName
                    ? "border-red-400 bg-red-50/20 focus:ring-red-100"
                    : "border-slate-300 bg-white focus:border-indigo-600 focus:ring-indigo-100"
                } focus:outline-none focus:ring-4 transition shadow-xs`}
              />
              {fieldErrors.fullName && (
                <p className="text-xs font-medium text-red-600 mt-1.5 flex items-center gap-1">
                  <span>•</span>
                  <span>{fieldErrors.fullName}</span>
                </p>
              )}
            </div>

            <div>
              <label htmlFor="nationalId" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                National ID / ת.ז <span className="text-red-500">*</span>
              </label>
              <input
                id="nationalId"
                name="nationalId"
                type="text"
                required
                maxLength={9}
                value={formData.nationalId}
                onChange={handleChange}
                placeholder="e.g. 012345678"
                className={`w-full px-4 py-2.5 text-sm rounded-xl border ${
                  fieldErrors.nationalId
                    ? "border-red-400 bg-red-50/20 focus:ring-red-100"
                    : "border-slate-300 bg-white focus:border-indigo-600 focus:ring-indigo-100"
                } focus:outline-none focus:ring-4 transition shadow-xs`}
              />
              {fieldErrors.nationalId && (
                <p className="text-xs font-medium text-red-600 mt-1.5 flex items-center gap-1">
                  <span>•</span>
                  <span>{fieldErrors.nationalId}</span>
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                disabled={Boolean(invitationInfo.email)}
                value={formData.email}
                onChange={handleChange}
                placeholder="jane@example.com"
                className={`w-full px-4 py-2.5 text-sm rounded-xl border ${
                  fieldErrors.email
                    ? "border-red-400 bg-red-50/20 focus:ring-red-100"
                    : "border-slate-300 bg-white focus:border-indigo-600 focus:ring-indigo-100"
                } disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-4 transition shadow-xs`}
              />
              {fieldErrors.email && (
                <p className="text-xs font-medium text-red-600 mt-1.5 flex items-center gap-1">
                  <span>•</span>
                  <span>{fieldErrors.email}</span>
                </p>
              )}
            </div>

            <div>
              <label htmlFor="phone" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Phone Number <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                placeholder="050-1234567"
                className={`w-full px-4 py-2.5 text-sm rounded-xl border ${
                  fieldErrors.phone
                    ? "border-red-400 bg-red-50/20 focus:ring-red-100"
                    : "border-slate-300 bg-white focus:border-indigo-600 focus:ring-indigo-100"
                } focus:outline-none focus:ring-4 transition shadow-xs`}
              />
              {fieldErrors.phone && (
                <p className="text-xs font-medium text-red-600 mt-1.5 flex items-center gap-1">
                  <span>•</span>
                  <span>{fieldErrors.phone}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Security & Password */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px]">
              2
            </span>
            <span>Security &amp; Password</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                placeholder="At least 6 characters"
                className={`w-full px-4 py-2.5 text-sm rounded-xl border ${
                  fieldErrors.password
                    ? "border-red-400 bg-red-50/20 focus:ring-red-100"
                    : "border-slate-300 bg-white focus:border-indigo-600 focus:ring-indigo-100"
                } focus:outline-none focus:ring-4 transition shadow-xs`}
              />
              {fieldErrors.password && (
                <p className="text-xs font-medium text-red-600 mt-1.5 flex items-center gap-1">
                  <span>•</span>
                  <span>{fieldErrors.password}</span>
                </p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter password"
                className={`w-full px-4 py-2.5 text-sm rounded-xl border ${
                  fieldErrors.confirmPassword
                    ? "border-red-400 bg-red-50/20 focus:ring-red-100"
                    : "border-slate-300 bg-white focus:border-indigo-600 focus:ring-indigo-100"
                } focus:outline-none focus:ring-4 transition shadow-xs`}
              />
              {fieldErrors.confirmPassword && (
                <p className="text-xs font-medium text-red-600 mt-1.5 flex items-center gap-1">
                  <span>•</span>
                  <span>{fieldErrors.confirmPassword}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Role Info */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px]">
              3
            </span>
            <span>Role Details <span className="text-slate-400 font-normal">(Optional)</span></span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="department" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Department / Team
              </label>
              <input
                id="department"
                name="department"
                type="text"
                value={formData.department}
                onChange={handleChange}
                placeholder="e.g. Operations, Sales"
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-300 bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 focus:outline-none transition shadow-xs"
              />
            </div>

            <div>
              <label htmlFor="jobTitle" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Job Title
              </label>
              <input
                id="jobTitle"
                name="jobTitle"
                type="text"
                value={formData.jobTitle}
                onChange={handleChange}
                placeholder="e.g. Account Specialist"
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-300 bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 focus:outline-none transition shadow-xs"
              />
            </div>
          </div>
        </div>

        {/* Terms */}
        <div className="pt-1">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              name="terms"
              checked={formData.terms}
              onChange={handleChange}
              className="mt-0.5 h-4 w-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-xs text-slate-600 leading-relaxed">
              I agree to the{" "}
              <Link
                href="/terms"
                target="_blank"
                className="text-indigo-600 font-semibold underline cursor-pointer hover:text-indigo-800"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                target="_blank"
                className="text-indigo-600 font-semibold underline cursor-pointer hover:text-indigo-800"
              >
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          {fieldErrors.terms && (
            <p className="text-xs font-medium text-red-600 mt-1.5 flex items-center gap-1">
              <span>•</span>
              <span>{fieldErrors.terms}</span>
            </p>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3.5 px-4 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed text-sm ${
              isManager
                ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20 disabled:bg-slate-300"
                : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20 disabled:bg-slate-300"
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Activating Account...</span>
              </>
            ) : (
              <>
                <span>Join {invitationInfo.companyName} as {isManager ? "Manager" : "Employee"}</span>
                <span className="font-normal opacity-70">→</span>
              </>
            )}
          </button>
        </div>

        <p className="border-t border-slate-100 pt-5 text-center text-xs text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-indigo-600 hover:text-indigo-800 transition">
            Sign in here →
          </Link>
        </p>
      </form>
    </div>
  );
}

