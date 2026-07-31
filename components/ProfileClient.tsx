"use client";

import { signOut } from "next-auth/react";

type ProfileClientProps = {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
};

export default function ProfileClient({ user }: ProfileClientProps) {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto min-h-screen max-w-3xl px-4 py-12 sm:px-6">
        <div className="rounded-3xl border border-white/10 bg-slate-900 p-8 shadow-2xl sm:p-10">
          <div className="mb-8">
            <h1 className="text-4xl font-semibold text-white">Profile</h1>
            <p className="mt-2 text-sm text-slate-400">Manage your account and chat history.</p>
          </div>

          <div className="grid gap-6 rounded-3xl border border-slate-800 bg-slate-950 p-6">
            <div>
              <p className="text-sm text-slate-500">Name</p>
              <p className="mt-1 text-lg font-medium text-white">{user.name ?? "Unknown"}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Email</p>
              <p className="mt-1 text-lg font-medium text-white">{user.email ?? "Unknown"}</p>
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="w-full rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
