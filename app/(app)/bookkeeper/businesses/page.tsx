import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
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
        description="Every client business your firm manages. Open one to file its documents."
      />

      {businesses.length === 0 ? (
        <EmptyState
          title="No businesses yet"
          description="Create your first client business, then come back here to upload its forms and contracts."
          action={
            <Link
              href="/dashboard"
              className="inline-flex rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              Go to the firm dashboard
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {businesses.map((business) => (
            <li
              key={business.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <Link
                href={`/bookkeeper/businesses/${business.id}`}
                className="block transition-colors hover:border-slate-300"
              >
                <p className="font-medium text-slate-900">{business.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Tax ID {business.taxId}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  {business.employeeCount}{" "}
                  {business.employeeCount === 1 ? "employee" : "employees"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
