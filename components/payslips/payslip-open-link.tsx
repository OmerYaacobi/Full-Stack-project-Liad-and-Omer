export function PayslipOpenLink({ payslipId }: { payslipId: string }) {
  return (
    <a
      href={`/api/payslips/${payslipId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="shrink-0 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
    >
      Open
    </a>
  );
}
