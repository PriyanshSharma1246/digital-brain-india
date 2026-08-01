import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center text-slate-100">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="mt-3 max-w-md text-sm text-slate-400">
        The page you requested could not be found. Return to the dashboard or chat to keep going.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/chat" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Open chat
        </Link>
        <Link href="/dashboard" className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800">
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
