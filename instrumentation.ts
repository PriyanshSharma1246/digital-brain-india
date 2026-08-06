/**
 * Phase 10 (Part 4) — Server instrumentation.
 *
 * Runs once when a new Next.js Node server instance starts: ensures the
 * connectors are registered, applies persisted connector config, and begins
 * the scheduled background refresh of important datasets. Guarded to the
 * Node runtime only (never the Edge runtime).
 */
import "@/lib/connectors";
import { applyConnectorConfigs } from "@/lib/connectors/config";
import { startConnectorScheduler } from "@/lib/connectors/scheduler";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await applyConnectorConfigs();
    startConnectorScheduler();
  }
}
