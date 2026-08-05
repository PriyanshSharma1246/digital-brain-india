"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";

/* ---------------------------------------------------------------------------
 * Types (mirror the API responses produced by lib/knowledge/admin)
 * ------------------------------------------------------------------------- */

interface DashboardStats {
  totalDocuments: number;
  totalChunks: number;
  lastIngestionAt: string | null;
}

interface DocumentSummary {
  id: string;
  title: string;
  description: string | null;
  category: string;
  subcategory: string | null;
  state: string | null;
  ministry: string | null;
  language: string;
  source: string;
  sourceUrl: string | null;
  publishedAt: string | null;
  tags: string[];
  version: string | null;
  checksum: string | null;
  contentType: string;
  sourcePath: string | null;
  contentHash: string | null;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
  ingestedAt: string;
}

interface ChunkDetail {
  id: string;
  chunkIndex: number;
  content: string;
  heading: string | null;
  headingPath: string[];
  hasTable: boolean;
  length: number;
  createdAt: string;
}

interface VersionDetail {
  id: string;
  version: string;
  checksum: string;
  createdAt: string;
}

interface DocumentDetail extends DocumentSummary {
  content: string;
  chunks: ChunkDetail[];
  versions: VersionDetail[];
}

interface ReingestResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

interface AnalyticsPayload {
  mostSearched: { query: string; count: number }[];
  failedSearchStats: { total: number; failed: number; failureRate: number };
  latencyStats: { averageMs: number; p95Ms: number; maxMs: number };
  embeddingCoverage: { totalChunks: number; embeddedChunks: number; coveragePercent: number };
  documentStats: { documentCount: number; chunkCount: number };
  categoryDistribution: { category: string; count: number }[];
}

interface JobSummary {
  id: string;
  type: string;
  status: string;
  progress: number;
  totalItems: number;
  processedItems: number;
  succeededItems: number;
  failedItems: number;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  _count: { documents: number; logs: number };
}

type KnowledgeDashboardProps = {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
};

/* ---------------------------------------------------------------------------
 * Small formatting helpers
 * ------------------------------------------------------------------------- */

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatHash(hash: string | null | undefined): string {
  if (!hash) return "—";
  return hash.length > 12 ? `${hash.slice(0, 12)}…` : hash;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/* ---------------------------------------------------------------------------
 * Dashboard component
 * ------------------------------------------------------------------------- */

export default function KnowledgeDashboard({ user }: KnowledgeDashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reingesting, setReingesting] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Analytics state
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Jobs state
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  // Upload state
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Detail drawer state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Delete-confirmation state
  const [deleteTarget, setDeleteTarget] = useState<DocumentSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  /** Loads dashboard stats + documents (used on mount, search and refresh). */
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
      const res = await fetch(`/api/admin/knowledge${query}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load dashboard");
      }
      setStats(data.stats);
      setDocuments(data.documents ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  /** Loads analytics data. */
  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch("/api/admin/knowledge?view=analytics", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.success) {
        setAnalytics(data.analytics);
      }
    } catch {
      // Non-fatal: analytics may be unavailable.
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  /** Loads recent ingestion jobs. */
  const loadJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const res = await fetch("/api/admin/knowledge/jobs", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.success) {
        setJobs(data.jobs ?? []);
      }
    } catch {
      // Non-fatal: jobs may be unavailable.
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  /** Loads a single document's full detail for the drawer. */
  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    try {
      const res = await fetch(`/api/admin/knowledge/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load document");
      }
      setDetail(data.document);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Failed to load document");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  /** Opens the detail drawer for a document. */
  function openDetail(doc: DocumentSummary) {
    setSelectedId(doc.id);
    void loadDetail(doc.id);
  }

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
    setDetailError(null);
  }

  /** Confirms a deletion then removes the document + chunks. */
  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/knowledge?id=${encodeURIComponent(deleteTarget.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete document");
      }
      if (selectedId === deleteTarget.id) closeDetail();
      setNotice(`Deleted "${deleteTarget.title}" (${deleteTarget.chunkCount} chunk(s)).`);
      setDeleteTarget(null);
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete document");
    } finally {
      setDeleting(false);
    }
  }

  /** Re-indexes existing chunks that are missing embeddings. */
  async function handleReindex() {
    setReindexing(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/knowledge?action=reindex", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Re-index failed");
      }
      setNotice(`Re-index complete — embedded ${data.reindexed} chunk(s).`);
      await loadDashboard();
      await loadAnalytics();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-index failed");
    } finally {
      setReindexing(false);
    }
  }

  /** Re-ingests the knowledge corpus using the existing ingestion pipeline. */
  async function handleReingest() {
    setReingesting(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/knowledge", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Re-ingestion failed");
      }
      const r: ReingestResult = data.result;
      setNotice(
        `Re-ingestion complete — created ${r.created}, updated ${r.updated}, ` +
          `skipped ${r.skipped}, failed ${r.failed}.`
      );
      await loadDashboard();
      await loadJobs();
      await loadAnalytics();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-ingestion failed");
    } finally {
      setReingesting(false);
    }
  }

  /** Re-indexes a single document. */
  async function handleReindexDocument(doc: DocumentSummary) {
    setReindexing(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/knowledge/${doc.id}/reindex`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Re-index failed for ${doc.title}`);
      }
      setNotice(`Re-indexed "${doc.title}" — embedded ${data.reindexed} chunk(s).`);
      await loadDashboard();
      await loadAnalytics();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Re-index failed for ${doc.title}`);
    } finally {
      setReindexing(false);
    }
  }

  /** Manual refresh (no server restart needed). */
  async function handleRefresh() {
    setRefreshing(true);
    setNotice(null);
    await loadDashboard();
    await loadJobs();
    await loadAnalytics();
    setRefreshing(false);
  }

  /** Uploads selected files to the knowledge base. */
  async function handleUpload() {
    if (uploadFiles.length === 0) return;
    setUploading(true);
    setNotice(null);
    setError(null);
    try {
      const formData = new FormData();
      for (const file of uploadFiles) {
        formData.append("files", file);
      }
      const res = await fetch("/api/admin/knowledge/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Upload failed");
      }
      setNotice(`Uploaded ${data.uploaded ?? uploadFiles.length} document(s).`);
      setUploadFiles([]);
      await loadDashboard();
      await loadJobs();
      await loadAnalytics();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  /** Drag & drop handlers. */
  function handleDragOver(event: React.DragEvent) {
    event.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(event: React.DragEvent) {
    event.preventDefault();
    setDragActive(false);
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragActive(false);
    const dropped = Array.from(event.dataTransfer.files ?? []);
    if (dropped.length > 0) {
      setUploadFiles((prev) => [...prev, ...dropped]);
    }
  }

  /** Client-side safety net over the server search (search is already filtered server-side). */
  const filteredDocuments = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return documents;
    return documents.filter((doc) =>
      [doc.title, doc.category, doc.sourcePath ?? "", doc.ministry ?? "", doc.state ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [documents, search]);

  return (
    <div className="flex flex-col gap-8">
      {/* Header + actions */}
      <header className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-blue-400">
              Admin · Knowledge Management
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-100">
              Knowledge Base Dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Manage the RAG knowledge corpus — upload documents, inspect metadata,
              preview content, view versions, re-index, and monitor ingestion jobs.
            </p>
            <p className="mt-3 text-sm text-slate-500">
              Signed in as {user.name ?? user.email}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => void handleRefresh()} loading={refreshing}>
              {refreshing ? "Refreshing…" : "↻ Refresh"}
            </Button>
            <Button variant="secondary" onClick={() => void handleReindex()} loading={reindexing}>
              {reindexing ? "Re-indexing…" : "Re-Index Embeddings"}
            </Button>
            <Button onClick={() => void handleReingest()} loading={reingesting}>
              {reingesting ? "Re-ingesting…" : "Re-Ingest Knowledge"}
            </Button>
          </div>
        </div>

        {notice ? (
          <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}
      </header>

      {/* Upload zone (drag & drop) */}
      <Card
        className={`transition-colors ${dragActive ? "border-blue-500 bg-blue-500/5" : ""}`}
      >
        <div
          className="flex flex-col items-center justify-center gap-3 p-8 text-center"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <p className="text-sm font-medium text-slate-300">
            Drag & drop documents here
          </p>
          <p className="text-xs text-slate-500">
            Supports Markdown, PDF, DOCX, TXT, HTML · bulk upload supported
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <label className="cursor-pointer rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-300 hover:border-slate-500">
              Choose files
              <input
                type="file"
                accept=".md,.markdown,.pdf,.docx,.txt,.html,.htm"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length > 0) setUploadFiles((prev) => [...prev, ...files]);
                }}
              />
            </label>
            <Button onClick={() => void handleUpload()} loading={uploading} disabled={uploadFiles.length === 0}>
              {uploading ? "Uploading…" : `Upload ${uploadFiles.length > 0 ? `(${uploadFiles.length})` : ""}`}
            </Button>
            {uploadFiles.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setUploadFiles([])}>
                Clear
              </Button>
            ) : null}
          </div>
          {uploadFiles.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-2">
              {uploadFiles.map((file, index) => (
                <Badge key={`${file.name}-${index}`} variant="secondary">
                  {file.name}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm text-slate-400">Total documents</p>
          <h2 className="mt-2 text-3xl font-bold text-blue-400">
            {stats ? stats.totalDocuments : "—"}
          </h2>
        </Card>
        <Card>
          <p className="text-sm text-slate-400">Total chunks</p>
          <h2 className="mt-2 text-3xl font-bold text-emerald-400">
            {stats ? stats.totalChunks : "—"}
          </h2>
        </Card>
        <Card>
          <p className="text-sm text-slate-400">Embedding coverage</p>
          <h2 className="mt-2 text-3xl font-bold text-yellow-400">
            {analytics ? formatPercent(analytics.embeddingCoverage.coveragePercent) : "—"}
          </h2>
          {analytics ? (
            <p className="mt-1 text-xs text-slate-500">
              {analytics.embeddingCoverage.embeddedChunks}/{analytics.embeddingCoverage.totalChunks} chunks
            </p>
          ) : null}
        </Card>
        <Card>
          <p className="text-sm text-slate-400">Last ingestion</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-100">
            {stats ? formatDate(stats.lastIngestionAt) : "—"}
          </h2>
        </Card>
      </div>

      {/* Analytics row */}
      {analytics ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Most searched topics</CardTitle>
              <CardDescription>Top queries across the knowledge base</CardDescription>
            </CardHeader>
            <div className="flex flex-col gap-2">
              {analytics.mostSearched.length === 0 ? (
                <p className="text-sm text-slate-500">No search data yet.</p>
              ) : null}
              {analytics.mostSearched.slice(0, 5).map((item) => (
                <div key={item.query} className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm text-slate-300">{item.query}</span>
                  <Badge variant="secondary">{item.count}</Badge>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Search health</CardTitle>
              <CardDescription>Failure rate and latency</CardDescription>
            </CardHeader>
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Total searches</span>
                <span className="font-medium text-slate-200">{analytics.failedSearchStats.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Failed searches</span>
                <span className="font-medium text-red-400">{analytics.failedSearchStats.failed}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Failure rate</span>
                <span className="font-medium text-yellow-400">
                  {formatPercent(analytics.failedSearchStats.failureRate)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Avg latency</span>
                <span className="font-medium text-emerald-400">
                  {analytics.latencyStats.averageMs} ms
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">P95 latency</span>
                <span className="font-medium text-emerald-400">
                  {analytics.latencyStats.p95Ms} ms
                </span>
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Category distribution</CardTitle>
              <CardDescription>Documents per category</CardDescription>
            </CardHeader>
            <div className="flex flex-col gap-2">
              {analytics.categoryDistribution.length === 0 ? (
                <p className="text-sm text-slate-500">No documents yet.</p>
              ) : null}
              {analytics.categoryDistribution.slice(0, 8).map((item) => (
                <div key={item.category} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-300">{item.category}</span>
                  <Badge variant="success">{item.count}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : null}

      {/* Ingestion jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Ingestion jobs</CardTitle>
          <CardDescription>Recent background ingestion activity</CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Progress</th>
                <th className="px-3 py-2 text-right">Processed</th>
                <th className="px-3 py-2 text-right">Failed</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {jobsLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-slate-400">
                    Loading jobs…
                  </td>
                </tr>
              ) : null}
              {!jobsLoading && jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-slate-400">
                    No ingestion jobs yet.
                  </td>
                </tr>
              ) : null}
              {!jobsLoading
                ? jobs.slice(0, 5).map((job) => (
                    <tr key={job.id} className="text-slate-300">
                      <td className="px-3 py-2 capitalize">{job.type}</td>
                      <td className="px-3 py-2">
                        <Badge
                          variant={
                            job.status === "completed"
                              ? "success"
                              : job.status === "failed"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {job.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">{job.progress}%</td>
                      <td className="px-3 py-2 text-right">
                        {job.processedItems}/{job.totalItems}
                      </td>
                      <td className="px-3 py-2 text-right">{job.failedItems}</td>
                      <td className="px-3 py-2 text-xs text-slate-400">
                        {formatDate(job.createdAt)}
                      </td>
                      <td className="max-w-xs truncate px-3 py-2 text-xs text-red-400">
                        {job.error ?? "—"}
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Documents table */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Documents</CardTitle>
            <CardDescription>
              {filteredDocuments.length} document(s) · search by title, category, ministry or state.
            </CardDescription>
          </div>
          <div className="sm:w-80">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search knowledge base…"
              aria-label="Search knowledge base"
            />
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Ministry</th>
                <th className="px-3 py-2">State</th>
                <th className="px-3 py-2 text-right">Chunks</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                    Loading knowledge base…
                  </td>
                </tr>
              ) : null}
              {!loading && filteredDocuments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                    No documents found.
                  </td>
                </tr>
              ) : null}
              {!loading
                ? filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="align-top text-slate-300 hover:bg-slate-900/40">
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => openDetail(doc)}
                          className="text-left font-medium text-blue-400 hover:text-blue-300 hover:underline"
                        >
                          {doc.title}
                        </button>
                        {doc.version ? (
                          <p className="mt-1 text-xs text-slate-500">v{doc.version}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="secondary">{doc.category}</Badge>
                      </td>
                      <td className="max-w-[160px] truncate px-3 py-3 text-xs text-slate-400">
                        {doc.ministry ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-400">
                        {doc.state ?? "All India"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Badge variant="success">{doc.chunkCount}</Badge>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-400">{doc.contentType}</td>
                      <td className="px-3 py-3 text-xs text-slate-400">
                        {formatDate(doc.updatedAt)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void handleReindexDocument(doc)}
                            disabled={reindexing}
                          >
                            Re-index
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => openDetail(doc)}>
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setDeleteTarget(doc)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Document detail drawer */}
      {selectedId ? (
        <Card className="relative border-slate-700">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>{detail?.title ?? "Loading…"}</CardTitle>
              <CardDescription>
                {detail?.category ?? "…"} · {detail?.source ?? "…"}
                {detail?.version ? ` · v${detail.version}` : ""}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={closeDetail}>
              ✕ Close
            </Button>
          </div>

          {detailError ? (
            <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
              {detailError}
            </p>
          ) : null}

          {detailLoading ? (
            <p className="mt-6 text-sm text-slate-400">Loading document detail…</p>
          ) : null}

          {!detailLoading && detail ? (
            <div className="mt-6 flex flex-col gap-6">
              {/* Metadata */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Description</p>
                  <p className="mt-1 text-sm text-slate-300">{detail.description ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Ministry</p>
                  <p className="mt-1 text-sm text-slate-300">{detail.ministry ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">State</p>
                  <p className="mt-1 text-sm text-slate-300">{detail.state ?? "All India"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Language</p>
                  <p className="mt-1 text-sm text-slate-300">{detail.language}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Source URL</p>
                  <p className="mt-1 break-all font-mono text-xs text-slate-300">
                    {detail.sourceUrl ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Published</p>
                  <p className="mt-1 text-xs text-slate-300">{formatDate(detail.publishedAt)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Checksum</p>
                  <p className="mt-1 font-mono text-xs text-slate-300">{formatHash(detail.checksum)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Content type</p>
                  <p className="mt-1 text-xs text-slate-300">{detail.contentType}</p>
                </div>
              </div>

              {/* Tags */}
              {detail.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {detail.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              ) : null}

              {/* Markdown preview */}
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Document preview
                </h3>
                <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-4">
                  <article className="prose prose-sm prose-invert max-w-none prose-headings:text-slate-100 prose-p:text-slate-300 prose-li:text-slate-300">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{detail.content}</ReactMarkdown>
                  </article>
                </div>
              </div>

              {/* Version history */}
              {detail.versions.length > 0 ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
                    Version history ({detail.versions.length})
                  </h3>
                  <div className="flex flex-col gap-2">
                    {detail.versions.map((version) => (
                      <div
                        key={version.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 px-4 py-2"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="warning">v{version.version}</Badge>
                          <span className="font-mono text-xs text-slate-400">
                            {formatHash(version.checksum)}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500">
                          {formatDate(version.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Chunks */}
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Chunks ({detail.chunks.length})
                </h3>
                <div className="flex flex-col gap-3">
                  {detail.chunks.length === 0 ? (
                    <p className="text-sm text-slate-500">No chunks for this document.</p>
                  ) : null}
                  {detail.chunks.map((chunk) => (
                    <div
                      key={chunk.id}
                      className="rounded-lg border border-slate-800 bg-slate-950 p-4"
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="warning">Chunk #{chunk.chunkIndex}</Badge>
                          {chunk.heading ? (
                            <Badge variant="secondary">📄 {chunk.heading}</Badge>
                          ) : null}
                          {chunk.hasTable ? <Badge variant="success">Table</Badge> : null}
                        </div>
                        <span className="text-xs text-slate-500">
                          {chunk.length.toLocaleString()} chars
                        </span>
                      </div>
                      {chunk.headingPath.length > 0 ? (
                        <p className="mb-2 text-xs text-slate-500">
                          Path: {chunk.headingPath.join(" › ")}
                        </p>
                      ) : null}
                      <pre className="whitespace-pre-wrap break-words font-sans text-sm text-slate-300">
                        {chunk.content}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* Delete confirmation dialog */}
      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-slate-100">Delete document?</h2>
            <p className="mt-3 text-sm text-slate-400">
              This will permanently delete{" "}
              <span className="font-medium text-slate-100">{deleteTarget.title}</span> and its{" "}
              {deleteTarget.chunkCount} chunk(s). This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => void confirmDelete()} loading={deleting}>
                {deleting ? "Deleting…" : "Delete document"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}