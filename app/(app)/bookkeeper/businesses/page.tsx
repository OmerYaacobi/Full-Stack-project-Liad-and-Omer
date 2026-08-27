import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { CreateBusinessButton } from "@/components/businesses/create-business-button";
import { listFirmBusinesses } from "@/lib/actions/businesses";

export const metadata: Metadata = {
  title: "Businesses",
};

export default async function BusinessesPage() {
  const { data: businesses } = await listFirmBusinesses();

  return (
    <>
      <PageHeader
        title="Businesses"
        description="Every client business your firm manages. Open one to file its documents or manage payroll."
        action={<CreateBusinessButton label="Add Business" />}
      />

      {businesses.length === 0 ? (
        <EmptyState
          title="No businesses yet"
          description="Create your first client business to start managing employees, generating onboarding invite links, and uploading smart payslips."
          action={<CreateBusinessButton label="Create your first business" />}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {businesses.map((business) => (
            <li
              key={business.id}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs hover:shadow-md hover:border-indigo-200 transition group relative"
            >
              <Link
                href={`/bookkeeper/businesses/${business.id}`}
                className="block"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shrink-0 group-hover:scale-105 group-hover:bg-indigo-600 group-hover:text-white transition">
                    🏢
                  </div>
                  <span className="text-xs font-semibold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                    Open →
                  </span>
                </div>
                <p className="font-bold text-slate-900 text-base leading-snug group-hover:text-indigo-600 transition-colors">
                  {business.name}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 font-medium">
                  Tax ID: {business.taxId}
                </p>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>👥 {business.employeeCount} {business.employeeCount === 1 ? "employee" : "employees"}</span>
                  <span className="text-[11px] font-medium text-slate-400">Manage payroll</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
