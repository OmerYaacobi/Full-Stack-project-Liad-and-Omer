import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-2xl mb-6 shadow-sm">
        🔍
      </div>
      <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl">
        Page not found
      </h1>
      <p className="mt-3 text-sm text-slate-600 max-w-md">
        Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been moved or removed.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}

