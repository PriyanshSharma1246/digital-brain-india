/**
 * Phase 10 (Part 3) — Shared environment-var helper for connectors.
 *
 * Safely reads a non-empty, trimmed environment variable without touching the
 * global `process` on the client (connectors are server-side only, but the
 * guard keeps the module safe to import anywhere).
 */
export function getEnvVar(name: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}