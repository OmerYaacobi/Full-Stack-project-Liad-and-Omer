export default function Loading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
      <p className="mt-4 text-sm font-medium text-slate-500">Loading...</p>
    </div>
  );
}
