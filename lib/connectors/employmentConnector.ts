/**
 * Phase 10 (Part 3) — Employment Connector (live + mock fallback).
 *
 * Returns job vacancies from the National Career Service (NCS) API when the
 * `NCS_CLIENT_ID` / `NCS_CLIENT_SECRET` environment variables are configured.
 * NCS uses an OAuth-style client-credentials token in the request body.
 *
 * On any failure (or when credentials are absent) it gracefully falls back
 * to the original mock implementation. Preserves the same `DataConnector`
 * shape and id.
 */
import type { DataConnector, ConnectorResult, ConnectorItem } from "./types";
import { httpJson } from "./http";
import { getEnvVar } from "./env";
import { mockResult, today } from "./mockHelpers";

const NCS_BASE_URL = getEnvVar("NCS_BASE_URL") ?? "https://api.ncs.gov.in";
const NCS_CLIENT_ID = getEnvVar("NCS_CLIENT_ID");
const NCS_CLIENT_SECRET = getEnvVar("NCS_CLIENT_SECRET");

/** True when NCS credentials are present and the live API can be attempted. */
function ncsConfigured(): boolean {
  return Boolean(NCS_CLIENT_ID && NCS_CLIENT_SECRET);
}

/** Picks the first non-empty string value for one of the provided keys. */
function pick(obj: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!obj) return undefined;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

/** Extracts a flat array of job records from a (possibly nested) NCS payload. */
function extractRecords(json: unknown): Array<Record<string, unknown>> {
  const root = json as Record<string, unknown> | undefined;
  const data = root?.data ?? root?.result ?? root ?? undefined;
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  if (data && typeof data === "object") {
    for (const key of ["data", "results", "jobs", "records", "items"]) {
      const candidate = (data as Record<string, unknown>)[key];
      if (Array.isArray(candidate)) return candidate as Array<Record<string, unknown>>;
    }
  }
  if (Array.isArray(json)) return json as Array<Record<string, unknown>>;
  return [];
}

/** Maps a single NCS job record to a normalized `ConnectorItem`. */
function normalizeNcsRecord(record: Record<string, unknown>): ConnectorItem | null {
  const title = pick(record, ["jobTitle", "title", "position", "vacancyName", "JobTitle"]);
  if (!title) return null;

  return {
    title,
    description: pick(record, ["jobDescription", "description", "JobDesc", "remark", "skills"]),
    url: pick(record, ["jobUrl", "applicationURL", "source"]) ?? "https://www.ncs.gov.in",
    source: "National Career Service",
    date: pick(record, ["lastDateToApply", "last_date", "postedDate", "created"]) ?? today(),
  };
}

/** Builds the original mock fallback result (unchanged content). */
function buildMock(query: string): ConnectorResult {
  const items: ConnectorItem[] = [
    {
      title: `Job vacancies matching "${query}"`,
      description: "Sample openings from National Career Service and public-sector portals.",
      url: "https://www.ncs.gov.in",
      source: "National Career Service",
      date: today(),
    },
    {
      title: "Skill India training programs",
      description: "Short-term and long-term skilling courses available online.",
      url: "https://www.swayam.gov.in/skills",
      source: "Ministry of Skill Development and Technology",
      date: today(),
    },
    {
      title: "MGNREGA job cards",
      description: "Work-demand registration statistics and wage data.",
      url: "https://nrega.nic.in",
      source: "Ministry of Rural Development",
      date: today(),
    },
  ];

  return mockResult("employment", query, "National Career Service", items);
}

/** Performs the live NCS job search (throws on failure). */
async function liveSearch(query: string): Promise<ConnectorResult> {
  if (!ncsConfigured()) throw new Error("NCS credentials not configured.");

  const json = await httpJson<unknown>({
    method: "POST",
    url: `${NCS_BASE_URL}/api/v1/SearchJobs`,
    body: {
      client_id: NCS_CLIENT_ID,
      client_secret: NCS_CLIENT_SECRET,
      keyword: query,
      page: 1,
      pageSize: 10,
    },
    timeoutMs: 12000,
    retries: 1,
    retryDelayMs: 800,
    connectorId: "employment",
    rateLimitKey: "employment",
    rateLimit: { capacity: 4, refillRate: 1, timeoutMs: 8000 },
  });

  const records = extractRecords(json);
  const items = records
    .map(normalizeNcsRecord)
    .filter((item): item is ConnectorItem => item !== null)
    .slice(0, 6);

  if (items.length === 0) throw new Error("No jobs returned from NCS.");

  return {
    connectorId: "employment",
    query,
    summary: `Found ${items.length} job opening(s) from National Career Service for "${query}".`,
    items,
    source: "National Career Service (NCS)",
    timestamp: Date.now(),
  };
}

export const employmentConnector: DataConnector = {
  id: "employment",
  name: "Employment",
  description:
    "Jobs, skill programs, and workforce-scheme data from the Ministry of Skill Development and Labour.",
  async isAvailable() {
    return true;
  },
  async search(query: string): Promise<ConnectorResult> {
    try {
      return await liveSearch(query);
    } catch {
      // Graceful fallback — the live source failed (or isn't configured).
      return buildMock(query);
    }
  },
};

export default employmentConnector;

