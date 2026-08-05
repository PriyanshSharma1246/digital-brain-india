import { NextResponse } from "next/server";

export function validateIdParam(id?: string) {
  if (!id) return { valid: false, reason: "missing" };
  // allow UUIDs and common slug formats
  const ok = /^[0-9a-fA-F-]{2,256}$/.test(id) || /^[A-Za-z0-9_-]{2,256}$/.test(id);
  return { valid: ok, reason: ok ? undefined : "invalid_format" };
}

export function requireSession(session: unknown) {
  const s = session as { user?: { id?: string; role?: string } } | undefined;
  if (!s?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  // If roles are present, enforce admin role for admin routes but keep
  // backward compatibility when `role` is not defined on the session.
  if (s.user.role !== undefined && s.user.role !== "admin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function chunkArray<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
