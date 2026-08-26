"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  bookkeeperSignupSchema,
  type BookkeeperSignupInput,
} from "@/lib/validations/auth";

export default function CompanySignupPage() {
  const [formData, setFormData] = useState<BookkeeperSignupInput>({
    firmName: "",
    taxId: "",
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    terms: false,
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const supabase = createClient();

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

    const validationResult = bookkeeperSignupSchema.safeParse(formData);
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
            firm_name: formData.firmName.trim(),
            tax_id: formData.taxId.trim(),
            full_name: formData.fullName.trim(),
            phone: formData.phone?.trim() || null,
            signup_type: "bookkeeper",
          },
        },
      });

      if (error) {
        setGeneralError(
          error.message === "User already registered"
            ? "A company account with this email address is already registered."
            : `Registration error: ${error.message}`,
        );
        return;
      }

      if (data?.user) {
        window.location.href = "/dashboard";
        return;
      }
    } catch {
      setGeneralError("An unexpected error occurred during company registration. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="w-full max-w-lg bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-3xl p-8 sm:p-10 shadow-xl shadow-slate-200/50 text-center">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-sm shadow-emerald-500/20">
          ✓
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 mb-2">
          Company Account Created!
        </h2>
        <p className="text-slate-600 text-sm sm:text-base mb-6 leading-relaxed">
          We have registered the organization account for{" "}
          <strong className="text-slate-800">{formData.firmName}</strong> (Tax ID: {formData.taxId}).
          <br className="my-2" />
          A verification link has been sent to{" "}
          <span className="font-semibold text-slate-900">{formData.email}</span>. Once verified, you can log in, add client businesses, and manage payroll.
        </p>
        <div className="flex justify-center">
          <Link
            href="/"
            className="inline-flex justify-center items-center px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition shadow-sm text-sm"
          >
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-3xl p-6 sm:p-10 shadow-xl shadow-slate-200/50 text-left transition-all">
      {/* Header */}
      <div className="border-b border-slate-100 pb-5 mb-6">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold tracking-wider uppercase rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
            🏢 Organization Registration
          </span>
          <Link
            href="/signup"
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
          >
            ← Change type
          </Link>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Register Company Account
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Set up your organization to manage businesses, bulk-upload payslips, and roster staff.
        </p>
      </div>

      {generalError && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3 shadow-xs">
          <span className="text-lg shrink-0">⚠️</span>
          <div className="flex-1 font-medium leading-relaxed">{generalError}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {/* Section 1: Company Identity */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px]">
              1
            </span>
            <span>Organization Information</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="firmName"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Company / Firm Name <span className="text-red-500">*</span>
              </label>
              <input
                id="firmName"
                name="firmName"
                type="text"
                required
                value={formData.firmName}
                onChange={handleChange}
                placeholder="e.g. Apex Booking & Payroll Ltd"
                className={`w-full px-4 py-2.5 text-sm rounded-xl border ${
                  fieldErrors.firmName
                    ? "border-red-400 bg-red-50/20 focus:ring-red-100"
                    : "border-slate-300 bg-white focus:border-indigo-600 focus:ring-indigo-100"
                } focus:outline-none focus:ring-4 transition shadow-xs`}
              />
              {fieldErrors.firmName && (
                <p className="text-xs font-medium text-red-600 mt-1.5 flex items-center gap-1">
                  <span>•</span>
                  <span>{fieldErrors.firmName}</span>
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="taxId"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Tax ID / Business # (ח.פ) <span className="text-red-500">*</span>
              </label>
              <input
                id="taxId"
                name="taxId"
                type="text"
                required
                value={formData.taxId}
                onChange={handleChange}
                placeholder="e.g. 514321987"
                className={`w-full px-4 py-2.5 text-sm rounded-xl border ${
                  fieldErrors.taxId
                    ? "border-red-400 bg-red-50/20 focus:ring-red-100"
                    : "border-slate-300 bg-white focus:border-indigo-600 focus:ring-indigo-100"
                } focus:outline-none focus:ring-4 transition shadow-xs`}
              />
              {fieldErrors.taxId && (
                <p className="text-xs font-medium text-red-600 mt-1.5 flex items-center gap-1">
                  <span>•</span>
                  <span>{fieldErrors.taxId}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Account Administrator */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px]">
              2
            </span>
            <span>Account Administrator</span>
          </div>

          <div>
            <label
              htmlFor="fullName"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
            >
              Administrator Full Name <span className="text-red-500">*</span>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Work Email Address <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="admin@company.com"
                className={`w-full px-4 py-2.5 text-sm rounded-xl border ${
                  fieldErrors.email
                    ? "border-red-400 bg-red-50/20 focus:ring-red-100"
                    : "border-slate-300 bg-white focus:border-indigo-600 focus:ring-indigo-100"
                } focus:outline-none focus:ring-4 transition shadow-xs`}
              />
              {fieldErrors.email && (
                <p className="text-xs font-medium text-red-600 mt-1.5 flex items-center gap-1">
                  <span>•</span>
                  <span>{fieldErrors.email}</span>
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="phone"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
              >
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

        {/* Section 3: Security */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px]">
              3
            </span>
            <span>Security &amp; Password</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
              >
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
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
              >
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
              <span className="text-indigo-600 font-semibold underline cursor-pointer hover:text-indigo-800">
                Terms of Service
              </span>{" "}
              and{" "}
              <span className="text-indigo-600 font-semibold underline cursor-pointer hover:text-indigo-800">
                Privacy Policy
              </span>
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
            className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed text-sm"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Registering Organization Account...</span>
              </>
            ) : (
              <>
                <span>Create Company Account</span>
                <span className="font-normal text-indigo-200">→</span>
              </>
            )}
          </button>
        </div>

        {/* Footer Link */}
        <p className="border-t border-slate-100 pt-5 text-center text-xs text-slate-500">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-bold text-indigo-600 hover:text-indigo-800 transition"
          >
            Sign in here →
          </Link>
        </p>
      </form>
    </div>
  );
}
