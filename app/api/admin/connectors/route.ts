import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireSession } from "@/lib/api/utils";
import { logError, logEvent } from "@/lib/logger";
import {
  getAllConnectors,
  getAllConnectorHealth,
  getAllMetrics,
  CONNECTOR_DISPLAY,
  type ConnectorHealth,
} from "@/lib/connectors";
import { upsertConnectorConfig, loadAllConnectorSettings } from "@/lib/connectors/config";
import { getHealthHistorySummary } from "@/lib/connectors/persistence";
import { refreshConnector, refreshAll } from "@/lib/connectors/scheduler";

/**
 * Admin Connectors API (Phase 10, Part 4).
 *
 * GET  /api/admin/connectors  -> live connector status + health snapshots
 * POST /api/admin/connectors  -> { action: "config", connectorId, ... } | { action: "refresh", connectorId? }
 *
 * Requires an authenticated session.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const authResp = requireSession(session);
  if (authResp) return authResp;

  try {
    const connectors = getAllConnectors();
    const healthById = new Map<string, ConnectorHealth>(
      getAllConnectorHealth().map((h) => [h.id, h])
    );
    const settingsMap = await loadAllConnectorSettings();
    const metricsById = getAllMetrics();
    const historySummaries = await Promise.all(
      connectors.map((c) => getHealthHistorySummary(c.id))
    );
    const historyById = new Map<string, NonNullable<(typeof historySummaries)[number]>>();
    for (const summary of historySummaries) {
      if (summary) historyById.set(summary.connectorId, summary);
    }

    const panel = connectors.map((connector) => {
      const display = CONNECTOR_DISPLAY[connector.id];
      const settings = settingsMap.get(connector.id);
      const history = historyById.get(connector.id);
      return {
        id: connector.id,
        name: connector.name,
        description: connector.description,
        icon: display?.icon ?? "🔌",
        label: display?.label ?? connector.name,
        enabled: settings?.enabled ?? true,
        refreshIntervalSeconds: settings?.refreshIntervalSeconds ?? 3600,
        health: healthById.get(connector.id) ?? null,
        metrics: metricsById[connector.id] ?? null,
        history,
      };
    });

    return NextResponse.json({ success: true, connectors: panel });
  } catch (error) {
    logError("Admin connectors status failed", {
      userId: session?.user?.id ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: "Unable to load connector status" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const authResp = requireSession(session);
  if (authResp) return authResp;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : null;

    if (action === "config") {
      const connectorId = typeof body.connectorId === "string" ? body.connectorId : null;
      if (!connectorId) {
        return NextResponse.json(
          { success: false, error: "connectorId is required" },
          { status: 400 }
        );
      }
      const patch: { enabled?: boolean; refreshIntervalSeconds?: number } = {};
      if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
      if (typeof body.refreshIntervalSeconds === "number") patch.refreshIntervalSeconds = body.refreshIntervalSeconds;
      if (Object.keys(patch).length === 0) {
        return NextResponse.json(
          { success: false, error: "At least one connector setting is required" },
          { status: 400 }
        );
      }
      const settings = await upsertConnectorConfig(connectorId, patch);
      logEvent("info", "Admin connector config updated", {
        userId: session?.user?.id ?? null,
        connectorId,
        settings,
      });
      return NextResponse.json({ success: true, settings });
    }

    if (action === "refresh") {
      const connectorId = typeof body.connectorId === "string" ? body.connectorId : null;
      let result: Record<string, boolean> = {};
      if (connectorId) {
        result[connectorId] = await refreshConnector(connectorId);
      } else {
        result = await refreshAll();
      }
      logEvent("info", "Admin connector refresh triggered", {
        userId: session?.user?.id ?? null,
        connectorId,
        result,
      });
      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json(
      { success: false, error: `Unsupported action: ${action ?? "null"}` },
      { status: 400 }
    );
  } catch (error) {
    logError("Admin connectors mutation failed", {
      userId: session?.user?.id ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: "Unable to mutate connector settings" },
      { status: 500 }
    );
  }
}
