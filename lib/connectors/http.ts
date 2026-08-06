/**
 * Phase 10 (Part 4) — Shared HTTP helper for connectors.
 *
 * A small, dependency-free wrapper around `fetch` that provides:
 *   - a hard timeout per attempt,
 *   - retries with **exponential backoff** (+ jitter),
 *   - optional token-bucket **rate limiting**,
 *   - optional **stale-while-revalidate** caching (serve stale + revalidate),
 *   - **structured logging** for every request.
 *
 * All failures are thrown as a typed `HttpError`. Connectors catch it and
 * gracefully fall back to their mock provider. Uses relative imports so the
 * module (and thus connector tests) can run under Node's test runner.
 */
import { setCache, getCacheWithStale } from "../cache";
import { acquire } from "./rateLimit";
import { logConnectorEvent, logConnectorError } from "./logger";

/** Typed error surfaced when an HTTP request fails. */
export class HttpError extends Error {
  /** HTTP status code, when the upstream responded (else undefined). */
  readonly status?: number;
  /** The underlying error that caused the failure (if any). */
  readonly cause?: unknown;

  constructor(message: string, opts: { status?: number; cause?: unknown } = {}) {
    super(message);
    this.name = "HttpError";
    this.status = opts.status;
    this.cause = opts.cause;
  }
}

/**
 * Options accepted by every connector request. Extends the phase-3 shape with
 * backoff limits, SWR and rate-limiting knobs (all optional / non-breaking).
 */
export interface HttpOptions {
  /** Request method (default "GET"). */
  method?: "GET" | "POST";
  /** Absolute URL to request. */
  url: string;
  /** Optional query params (undefined values are skipped). */
  query?: Record<string, string | number | boolean | undefined>;
  /** Request headers (merged over defaults). */
  headers?: Record<string, string>;
  /** JSON body for POST requests. */
  body?: unknown;
  /** Per-attempt timeout in ms (default 8000). */
  timeoutMs?: number;
  /** Number of retries after the first attempt (default 2). */
  retries?: number;
  /** Base retry delay in ms; backoff grows exponentially (default 500). */
  retryDelayMs?: number;
  /** Cap on the exponential backoff delay in ms (default 10000). */
  backoffMaxMs?: number;
  /** Cache TTL in seconds; omit / 0 to disable. */
  cacheTtlSeconds?: number;
  /** Serve stale values for up to N seconds past TTL (SWR). */
  swrStaleSeconds?: number;
  /** Override the cache key (defaults to method + url). */
  cacheKey?: string;
  /** Enables rate limiting; key identifies the bucket (e.g. connector id). */
  rateLimitKey?: string;
  /** Rate limit options for the bucket (token bucket). */
  rateLimit?: { capacity?: number; refillRate?: number; timeoutMs?: number };
  /** Connector id for structured logs. */
  connectorId?: string;
}

const DEFAULTS = {
  timeoutMs: 8000,
  retries: 2,
  retryDelayMs: 500,
  backoffMaxMs: 10000,
  cacheTtlSeconds: 600,
  swrStaleSeconds: 300, // 5 minutes of staleness allowed while revalidating
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitterMs(): number {
  return Math.floor(Math.random() * 150);
}

function withQuery(url: string, query?: Record<string, string | number | boolean | undefined>): string {
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const qs = params.toString();
  if (!qs) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${qs}`;
}

/** Performs a single request with a hard timeout and parses JSON. */
async function doFetch(
  method: "GET" | "POST",
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const mergedHeaders: Record<string, string> = { Accept: "application/json", ...headers };
  const init: RequestInit = {
    method,
    headers: mergedHeaders,
    cache: "no-store",
    signal: controller.signal,
  };
  if (body !== undefined) {
    mergedHeaders["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, init);
    if (!response.ok) {
      throw new HttpError(`HTTP ${response.status}`, { status: response.status });
    }
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new HttpError("Upstream returned a non-JSON response.");
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError("Request timed out or failed.", { cause: error });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Background revalidation used by stale-while-revalidate: refreshes the cache
 * after serving a stale value so the next request is fresh. Errors are
 * swallowed — stale data is served until a later revalidation succeeds.
 */
async function revalidate(
  cacheKey: string,
  method: "GET" | "POST",
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
  ttlSeconds: number
): Promise<void> {
  try {
    const data = await doFetch(method, url, headers, body, timeoutMs);
    setCache(cacheKey, data, ttlSeconds);
  } catch {
    // Ignore — keep serving stale until a later revalidation succeeds.
  }
}

/**
 * Issues a request with timeout + retry (exponential backoff) + optional rate
 * limiting + SWR caching, returning parsed JSON. Only GET responses are
 * cached (POST bodies are generally non-idempotent).
 */
export async function httpJson<T = unknown>(options: HttpOptions): Promise<T> {
  const method = options.method ?? "GET";
  const connectorId = options.connectorId ?? "unknown";
  const url = withQuery(options.url, options.query);
  const timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;
  const retryCount = Math.max(0, options.retries ?? DEFAULTS.retries);
  const baseDelay = options.retryDelayMs ?? DEFAULTS.retryDelayMs;
  const backoffMaxMs = options.backoffMaxMs ?? DEFAULTS.backoffMaxMs;
  const ttl = options.cacheTtlSeconds ?? 0;
  const staleSeconds = options.swrStaleSeconds ?? (ttl > 0 ? DEFAULTS.swrStaleSeconds : 0);

  const cacheKey = method === "GET" ? options.cacheKey ?? `http:${method}:${url}` : undefined;

  // 1. Rate limiting gate — wait for a token before hitting the network.
  if (options.rateLimitKey && options.rateLimit) {
    const ok = await acquire(options.rateLimitKey, options.rateLimit);
    if (!ok) {
      throw new HttpError("Rate limit timeout exceeded while waiting for a token.");
    }
  }

  // 2. Cache read with stale-while-revalidate.
  if (cacheKey && ttl > 0) {
    const read = getCacheWithStale<T>(cacheKey, staleSeconds);
    if (read.fresh) {
      return read.value as T;
    }
    if (read.isStale) {
      // Serve stale immediately; revalidate in the background (SWR).
      void revalidate(cacheKey, method, url, options.headers ?? {}, options.body, timeoutMs, ttl);
      logConnectorEvent("info", "served stale connector response", {
        connectorId,
        mode: "live",
      });
      return read.value as T;
    }
  }

  // 3. Fresh fetch with retry + exponential backoff.
  let lastError: unknown;
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    if (attempt > 0) {
      const backoff = Math.min(baseDelay * Math.pow(2, attempt), backoffMaxMs);
      await sleep(backoff + jitterMs());
    }

    const started = Date.now();
    try {
      const data = await doFetch(method, url, options.headers ?? {}, options.body, timeoutMs);
      const latencyMs = Date.now() - started;
      logConnectorEvent("info", "connector http ok", {
        connectorId,
        mode: "live",
        latencyMs,
        attempt,
      });
      if (cacheKey && ttl > 0) setCache(cacheKey, data, ttl);
      return data as T;
    } catch (error) {
      lastError = error;
      const latencyMs = Date.now() - started;
      const status = error instanceof HttpError ? error.status : undefined;
      logConnectorEvent("warn", "connector http attempt failed", {
        connectorId,
        mode: "error",
        latencyMs,
        attempt,
        status,
        error: error instanceof Error ? error.message : String(error),
      });
      if (attempt >= retryCount) break;
    }
  }

  logConnectorError("connector http failed after retries", { connectorId, mode: "error" });
  if (lastError instanceof HttpError) throw lastError;
  throw new HttpError("HTTP request failed after all retry attempts.", { cause: lastError });
}
