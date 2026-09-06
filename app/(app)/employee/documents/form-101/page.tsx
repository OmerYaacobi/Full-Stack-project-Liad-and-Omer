import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Form101Upload } from "@/components/form-101/form-101-upload";
import { PageHeader } from "@/components/shared/page-header";
import { getMyEmployee } from "@/lib/actions/employees";
import { requireMembership } from "@/lib/auth/context";

const TOFES_101_URL = "https://tofes101.co.il/forms/itc-101/submit/";

export const metadata: Metadata = {
  title: "Form 101",
};

export default async function Form101Page() {
  const ctx = await requireMembership();
  const employee = await getMyEmployee(ctx.membership.id, ctx.membership.company.id);
  if (!employee) notFound();

  const taxYear = new Date().getFullYear();

  return (
    <>
      <nav className="mb-4 text-sm text-slate-500">
        <Link href="/employee/documents" className="hover:text-slate-900">
          Documents
        </Link>
        <span className="mx-2 text-slate-300">/</span>
        <span className="text-slate-700">Form 101</span>
      </nav>

      <PageHeader
        title="Form 101"
        description="Optional. Skip this if payroll already has your 101."
      />

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-medium text-slate-900">How to fill it</h2>
        <ol className="mt-3 list-decimal space-y-2 ps-5 text-sm text-slate-700">
          <li>
            Open{" "}
            <a
              href={TOFES_101_URL}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-slate-900 underline underline-offset-2"
            >
              the Form 101 site
            </a>{" "}
            and answer the questions there.
          </li>
          <li>Save or download the PDF it creates. Do not email it to work.</li>
          <li>Come back here and upload that file below.</li>
        </ol>
        <a
          href={TOFES_101_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Fill Form 101
        </a>
      </section>

      <div className="mt-8">
        <Form101Upload taxYear={taxYear} />
      </div>
    </>
  );
}
