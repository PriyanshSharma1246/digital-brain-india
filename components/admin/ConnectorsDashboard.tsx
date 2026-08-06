"use client";

/**
 * Phase 10 (Part 4) — Connector Health dashboard (admin).
 *
 * Fetches live connector health + config + history from `/api/admin/connectors`
 * and renders availability, response time, last successful sync, error counts,
 * persisted history, and per-connector config controls.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";

type ConnectorHistory = {
  connectorId: string;
  requests: number;
  failures: number;
  successCount: number;
  avgLatencyMs: number | null;
  lastAt: number | null;
  mockCount: number;
};

type ConnectorMetrics = {
  requests: number;
  failures: number;
  lastLatencyMs: number;
  uptimeMs: number;
} | null;

type Health = {
  id: string;
  name: string;
  available: boolean;
  responseTimeMs: number | null;
  lastSuccessAt: number | null;
  lastAttemptAt: number | null;
  errorCount: number;
  successCount: number;
  lastMode: "live" | "mock" | null;
};

type ConnectorRow = {
  id: string;
  name: string;
  description: string;
  icon: string;
  label: string;
  enabled: boolean;
  refreshIntervalSeconds: number;
  health: Health | null;
  metrics: ConnectorMetrics;
  history: ConnectorHistory | null;
};

function formatInterval(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function formatMs(ms: number | null): string {
  if (ms === null) return "—";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`;
}

function formatDate(ts: number | null): string {
  if (ts === null) return "Never";
  return new Date(ts).toLocaleString();
}

export default function ConnectorsDashboard() {
  const [rows, setRows] = useState<ConnectorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/connectors", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Failed to load connector status.");
        setRows([]);
        return;
      }
      setRows(data.connectors ?? []);
      setError(null);
    } catch {
      setError("Unable to load connector status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(id);
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      void load();
    }, 30_000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  async function handleRefreshAll() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Refresh failed.");
      } else {
        await load();
      }
    } catch {
      setError("Unable to refresh connectors.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleRefreshOne(connectorId: string) {
    try {
      await fetch("/api/admin/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh", connectorId }),
      });
      await load();
    } catch {
      setError("Unable to refresh connector.");
    }
  }

  async function handleSaveConfig(
    connectorId: string,
    patch: { enabled?: boolean; refreshIntervalSeconds?: number }
  ) {
    setSaving(connectorId);
    try {
      const res = await fetch("/api/admin/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "config", connectorId, ...patch }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Config update failed.");
      } else {
        await load();
      }
    } catch {
      setError("Unable to update connector config.");
    } finally {
      setSaving(null);
    }
  }

  const summary = rows.reduce(
    (acc, row) => {
      acc.total += 1;
      if (row.health?.lastMode === "live") acc.live += 1;
      if (row.health?.lastMode === "mock") acc.mock += 1;
      acc.errors += row.health?.errorCount ?? 0;
      acc.requests += row.history?.requests ?? 0;
      return acc;
    },
    { total: 0, live: 0, mock: 0, errors: 0, requests: 0 }
  );

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Connector Health</h1>
          <p className="text-sm text-slate-400">
            Live status of all government data connectors (IMD weather, NCS
            jobs, data.gov.in datasets, schemes & agriculture).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          <button
            onClick={handleRefreshAll}
            disabled={refreshing}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh All"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading connector status…</p>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard label="Connectors" value={summary.total} />
            <SummaryCard label="Live (last result)" value={summary.live} />
            <SummaryCard label="Mock fallback" value={summary.mock} />
            <SummaryCard label="Total errors" value={summary.errors} />
            <SummaryCard label="Persisted requests" value={summary.requests} />
          </div>

          {!loading && rows.length === 0 && !error && (
            <p className="text-sm text-slate-400">No connectors registered.</p>
          )}
        </>
      )}

      <div className="space-y-4">
        {rows.map((row) => {
          const h = row.health;
          const statusBadge =
            h?.lastMode === null
              ? { text: "Idle", cls: "bg-slate-700 text-slate-200" }
              : h?.lastMode === "live"
                ? { text: "Live", cls: "bg-emerald-600/90 text-emerald-50" }
                : { text: "Mock fallback", cls: "bg-amber-600/80 text-amber-50" };
          const history = row.history;
          return (
            <div
              key={row.id}
              className="rounded-lg border border-slate-800 bg-slate-900 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden>
                    {row.icon}
                  </span>
                  <div>
                    <h3 className="font-semibold">{row.name}</h3>
                    <p className="max-w-xl text-sm text-slate-400">
                      {row.description}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${statusBadge.cls}`}
                >
                  {statusBadge.text}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
                <Metric
                  label="Availability"
                  value={h?.available ? "Available" : "Unavailable"}
                />
                <Metric label="Response time" value={formatMs(h?.responseTimeMs ?? null)} />
                <Metric label="Last success" value={formatDate(h?.lastSuccessAt ?? null)} />
                <Metric label="Live results" value={String(h?.successCount ?? 0)} />
                <Metric label="Errors" value={String(h?.errorCount ?? 0)} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
                <Metric label="Persisted requests" value={String(history?.requests ?? 0)} />
                <Metric label="Persisted failures" value={String(history?.failures ?? 0)} />
                <Metric label="Persisted mock" value={String(history?.mockCount ?? 0)} />
                <Metric label="Avg latency" value={formatMs(history?.avgLatencyMs ?? null)} />
                <Metric label="Last request" value={formatDate(history?.lastAt ?? null)} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
                <Metric label="Live requests" value={String(row.metrics?.requests ?? 0)} />
                <Metric label="Live failures" value={String(row.metrics?.failures ?? 0)} />
                <Metric label="Last latency" value={formatMs(row.metrics?.lastLatencyMs ?? null)} />
                <Metric label="Service uptime" value={formatMs(row.metrics?.uptimeMs ?? null)} />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) =>
                      handleSaveConfig(row.id, { enabled: e.target.checked })
                    }
                    disabled={saving === row.id}
                  />
                  Enabled
                </label>
                <select
                  value={row.refreshIntervalSeconds}
                  onChange={(e) =>
                    handleSaveConfig(row.id, {
                      refreshIntervalSeconds: Number(e.target.value),
                    })
                  }
                  disabled={saving === row.id}
                  className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-200"
                >
                  <option value={300}>5 min</option>
                  <option value={900}>15 min</option>
                  <option value={1800}>30 min</option>
                  <option value={3600}>1 hour</option>
                  <option value={7200}>2 hours</option>
                </select>
                <span className="text-xs text-slate-500">
                  Refresh: {formatInterval(row.refreshIntervalSeconds)}
                </span>
                <button
                  onClick={() => handleRefreshOne(row.id)}
                  className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
                >
                  Refresh now
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-slate-400">{label}</div>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number | ReactNode;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 font-medium text-slate-200">{value}</div>
    </div>
  );
}
