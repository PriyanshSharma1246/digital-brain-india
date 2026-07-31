"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { ChevronDown, LogOut, User } from "lucide-react";

export default function Navbar() {
  const { status, data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="flex flex-wrap items-center justify-between gap-4 px-10 py-6 md:flex-nowrap">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-2xl font-bold text-blue-400">
          🇮🇳 India Digital Brain
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <Link href="/" className="text-sm font-medium text-slate-300 transition hover:text-blue-400">
          Home
        </Link>
        <Link href="/chat" className="text-sm font-medium text-slate-300 transition hover:text-blue-400">
          Chat
        </Link>
        <Link href="/register" className="text-sm font-medium text-slate-300 transition hover:text-blue-400">
          Register
        </Link>

        {status === "loading" ? null : session?.user ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-blue-500"
            >
              <span>{session.user.name ?? session.user.email}</span>
              <ChevronDown className="h-4 w-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 z-20 mt-2 w-64 rounded-3xl border border-slate-800 bg-slate-950 p-4 shadow-2xl">
                <div className="mb-3 rounded-2xl bg-slate-900 p-3">
                  <p className="text-sm font-semibold text-slate-100">{session.user.name ?? "Your profile"}</p>
                  <p className="text-xs text-slate-500">{session.user.email}</p>
                </div>
                <Link
                  href="/profile"
                  className="mb-2 flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-slate-100 transition hover:bg-slate-800"
                  onClick={() => setMenuOpen(false)}
                >
                  <User className="h-4 w-4" />
                  Profile
                </Link>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="flex w-full items-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-500"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Signup
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
