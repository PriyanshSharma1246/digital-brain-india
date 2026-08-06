/**
 * Phase 10 (Part 4) — Token-bucket rate limiter for connectors.
 *
 * Each bucketed key (typically a connector id) can burst up to `capacity`
 * requests and is refilled at `refillRate` tokens/second. Used by the shared
 * HTTP helper so connectors never hammer an upstream API.
 *
 * The module is dependency-free so it can be unit tested in isolation.
 */

export interface RateLimitOptions {
  /** Maximum burst capacity (tokens available at once). */
  capacity: number;
  /** Tokens refilled per second. */
  refillRate: number;
  /** How long to keep waiting for a token (ms) before timing out. */
  timeoutMs: number;
}

const DEFAULT_OPTIONS: RateLimitOptions = {
  capacity: 10,
  refillRate: 2,
  timeoutMs: 10000,
};

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

function resolveOptions(options: Partial<RateLimitOptions>): RateLimitOptions {
  return { ...DEFAULT_OPTIONS, ...options };
}

function getBucket(key: string, options: RateLimitOptions): Bucket {
  let bucket = buckets.get(key);
  const now = Date.now();
  if (!bucket) {
    bucket = { tokens: options.capacity, lastRefill: now };
    buckets.set(key, bucket);
    return bucket;
  }
  const elapsedMs = now - bucket.lastRefill;
  if (elapsedMs > 0) {
    bucket.tokens = Math.min(
      options.capacity,
      bucket.tokens + (elapsedMs / 1000) * options.refillRate
    );
    bucket.lastRefill = now;
  }
  return bucket;
}

function doAcquire(key: string, options: RateLimitOptions): boolean {
  const bucket = getBucket(key, options);
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }
  return false;
}

/** Attempts to consume one token; returns false when the bucket is empty. */
export function tryAcquire(key: string, options: Partial<RateLimitOptions> = {}): boolean {
  return doAcquire(key, resolveOptions(options));
}

/**
 * Waits (up to `timeoutMs`) for a token to become available. Returns true
 * when a token was acquired, false on timeout.
 */
export async function acquire(
  key: string,
  options: Partial<RateLimitOptions> = {}
): Promise<boolean> {
  const opts = resolveOptions(options);
  const deadline = Date.now() + opts.timeoutMs;

  while (Date.now() < deadline) {
    if (tryAcquire(key, opts)) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return tryAcquire(key, opts);
}

/** Remaining tokens in the bucket for a key (mostly for tests). */
export function availableTokens(key: string, options: Partial<RateLimitOptions> = {}): number {
  const opts = resolveOptions(options);
  return getBucket(key, opts).tokens;
}

/** Clears the limiter (entire store, or a single key). Useful in tests. */
export function resetRateLimit(key?: string): void {
  if (key) {
    buckets.delete(key);
  } else {
    buckets.clear();
  }
}
