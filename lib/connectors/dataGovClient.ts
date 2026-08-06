/**
 * Phase 10 (Part 2) — Data.gov.in reusable API client.
 *
 * A thin, dependency-free HTTP client for India's national open-data portal
 * (https://data.gov.in / https://api.data.gov.in). It:
 *   - reads DATA_GOV_API_KEY from the environment,
 *   - supports configurable timeout, retries and backoff,
 *   - caches successful responses for 10 minutes (via lib/cache.ts),
 *   - returns normalized results so the connector layer never has to
 *     understand the wire format.
 *
 * Failures are graceful: network errors, timeouts, non-2xx responses and
 * malformed payloads are surfaced as a typed `DataGovApiError` so the caller
 * (the connector) can decide to fall back to mock data.
 */
import { getCache, setCache } from "@/lib/cache";

/** Environment variable that holds the data.gov.in API key. */
export const DATA_GOV_API_KEY_ENV = "DATA_GOV_API_KEY";

/** Default base URL for the data.gov.in REST API. */
export const DATA_GOV_BASE_URL = "https://api.data.gov.in";

/** A single normalized dataset / record. */
export interface DataGovItem {
  title: string;
  description?: string;
  url?: string;
  source?: string;
  date?: string;
  raw?: unknown;
}

/** Normalized search result returned by the client. */
export interface DataGovSearchResult {
  /** Normalized items (empty when no records were found). */
  items: DataGovItem[];
  /** True when the API reported success but returned no usable records. */
  empty: boolean;
  /** True when the result was served from the in-memory cache. */
  fromCache?: boolean;
}

/** Typed error surfaced to callers so they can fall back cleanly. */
export class DataGovApiError extends Error {
  /** The underlying error that caused this failure (if any). */
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "DataGovApiError";
    this.cause = cause;
  }
}

/** Tunable options for a data.gov.in client. */
export interface DataGovClientOptions {
  /** Override the API key (defaults to process.env.DATA_GOV_API_KEY). */
  apiKey?: string;
  /** Override the base URL (useful for tests / proxies). */
  baseUrl?: string;
  /** Per-attempt timeout in milliseconds. */
  timeoutMs?: number;
  /** Number of times to retry a failed / timed-out request. */
  retries?: number;
  /** Base delay between retries in milliseconds (scaled per attempt). */
  retryDelayMs?: number;
  /** How long (seconds) successful results are cached (default 600 = 10 min). */
  cacheTtlSeconds?: number;
}

/** Default values, kept internal so exported configs stay concise. */
const DEFAULTS = {
  baseUrl: DATA_GOV_BASE_URL,
  timeoutMs: 8000,
  retries: 2,
  retryDelayMs: 500,
  cacheTtlSeconds: 600, // 10 minutes
};

/**
 * Reads the data.gov.in API key from the environment.
 * Exposed separately so callers can inject a custom env map (e.g. in tests).
 */
export function readDataGovApiKey(
  env: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {}
): string | undefined {
  const value = env[DATA_GOV_API_KEY_ENV];
  return value && value.trim() ? value.trim() : undefined;
}

/** Picks the first non-empty string value for one of the provided keys. */
function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

/** Maps a single API record to a normalized DataGovItem. */
function normalizeRecord(record: unknown): DataGovItem | null {
  if (!record || typeof record !== "object") return null;

  const r = record as Record<string, unknown>;
  const title = pickString(r, ["title", "name", "Title", "dataset", "dataset_title"]);
  if (!title) return null;

  return {
    title,
    description: pickString(r, ["description", "snippet", "notes", "abstract", "summary"]),
    url:
      pickString(r, ["url", "resource_url", "link", "source_url", "download_url"]) ??
      DATA_GOV_BASE_URL,
    source:
      pickString(r, ["source", "org", "organization", "department", "publisher", "source_name"]) ??
      "data.gov.in",
    date: pickString(r, ["date", "created", "published", "updated", "last_updated", "record_date"]),
    raw: record,
  };
}

/** Interprets the (possibly deeply wrapped) API JSON payload. */
function normalizeResult(payload: unknown): DataGovSearchResult {
  if (payload === null || typeof payload !== "object") {
    return { items: [], empty: true };
  }

  const root = payload as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;

  const rawRecords = Array.isArray(data.records)
    ? (data.records as unknown[])
    : Array.isArray(data.datasets)
      ? (data.datasets as unknown[])
      : [];

  const items = rawRecords
    .map(normalizeRecord)
    .filter((item): item is DataGovItem => item !== null);

  return { items, empty: items.length === 0 };
}

/** Builds the catalog search URL for data.gov.in. */
function buildSearchUrl(opts: {
  baseUrl: string;
  apiKey: string;
  query: string;
}): string {
  const params = new URLSearchParams({
    "api-key": opts.apiKey,
    format: "json",
    q: opts.query,
    offset: "0",
    limit: "10",
  });
  return `${opts.baseUrl}/catalog?${params.toString()}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Performs a single fetch with a hard timeout and parses JSON. */
async function fetchJson(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new DataGovApiError(`Data.gov.in responded with HTTP ${response.status}.`);
    }
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new DataGovApiError("Data.gov.in returned a non-JSON response.");
    }
  } catch (error) {
    if (error instanceof DataGovApiError) throw error;
    throw new DataGovApiError("Data.gov.in request timed out or failed.", error);
  } finally {
    clearTimeout(timer);
  }
}

/** The client surface exposed to connectors. */
export interface DataGovClient {
  /** The resolved API key (undefined when not configured). */
  readonly apiKey: string | undefined;
  /** True when an API key is present and the client can hit the live API. */
  readonly isConfigured: boolean;
  /** Searches the data.gov.in catalog, returning normalized results. */
  search(query: string): Promise<DataGovSearchResult>;
}

/**
 * Creates a reusable data.gov.in client with configurable timeout, retries
 * and caching. Results are cached for 10 minutes by default.
 */
export function createDataGovClient(
  options: DataGovClientOptions = {}
): DataGovClient {
  const apiKey = options.apiKey ?? readDataGovApiKey();
  const baseUrl = (options.baseUrl ?? DEFAULTS.baseUrl).replace(/\/+$/, "");
  const timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;
  const retries = options.retries ?? DEFAULTS.retries;
  const retryDelayMs = options.retryDelayMs ?? DEFAULTS.retryDelayMs;
  const cacheTtlSeconds = options.cacheTtlSeconds ?? DEFAULTS.cacheTtlSeconds;

  return {
    apiKey,
    isConfigured: Boolean(apiKey && apiKey.trim().length > 0),

    async search(query: string): Promise<DataGovSearchResult> {
      if (!apiKey) {
        throw new DataGovApiError(`${DATA_GOV_API_KEY_ENV} is not configured.`);
      }

      const cacheKey = `data-gov:${baseUrl}:${query.trim().toLowerCase()}`;
      const cached = getCache<DataGovSearchResult>(cacheKey);
      if (cached) return { ...cached, fromCache: true };

      const url = buildSearchUrl({ baseUrl, apiKey, query });
      let lastError: unknown;

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const payload = await fetchJson(url, timeoutMs);
          const result = normalizeResult(payload);
          // Only cache meaningful results so an empty transient response
          // doesn't blanket other queries.
          if (!result.empty) setCache(cacheKey, result, cacheTtlSeconds);
          return result;
        } catch (error) {
          lastError = error;
          if (attempt < retries) {
            await sleep(retryDelayMs * (attempt + 1));
          }
        }
      }

      throw new DataGovApiError(
        "Data.gov.in request failed after all retry attempts.",
        lastError
      );
    },
  };
}

/** Default client (reads DATA_GOV_API_KEY from the environment). */
export const dataGovClient: DataGovClient = createDataGovClient();

export default dataGovClient;

