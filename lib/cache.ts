type CacheEntry<T> = { value: T; expiresAt: number; updatedAt: number };

const store = new Map<string, CacheEntry<unknown>>();

/**
 * Stores a value with a TTL. Phase 10 Part 4 adds `updatedAt` so callers can
 * implement stale-while-revalidate (see `getCacheWithStale`). The public
 * `setCache` / `getCache` / `clearCache` API is unchanged.
 */
export function setCache<T>(key: string, value: T, ttlSeconds = 60) {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
    updatedAt: Date.now(),
  });
}

export function getCache<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function clearCache(key: string) {
  store.delete(key);
}

export interface CacheRead<T> {
  /** Cached value, or null when absent / fully expired. */
  value: T | null;
  /** True when the value is served stale (past TTL but within stale window). */
  isStale: boolean;
  /** True when the value is fresh (within TTL). */
  fresh: boolean;
}

/**
 * Stale-while-revalidate read: returns fresh values normally, and stale
 * values that are within `staleWindowSeconds` past their TTL so callers can
 * serve old data while revalidating in the background.
 */
export function getCacheWithStale<T>(
  key: string,
  staleWindowSeconds = 0
): CacheRead<T> {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return { value: null, isStale: false, fresh: false };

  const now = Date.now();
  if (now <= entry.expiresAt) {
    return { value: entry.value, isStale: false, fresh: true };
  }
  if (staleWindowSeconds > 0 && now <= entry.expiresAt + staleWindowSeconds * 1000) {
    return { value: entry.value, isStale: true, fresh: false };
  }

  store.delete(key);
  return { value: null, isStale: false, fresh: false };
}

/** Remaining TTL (seconds) for a key, or null when absent/expired. */
export function getCacheTtl(key: string): number | null {
  const entry = store.get(key);
  if (!entry) return null;
  const remainingMs = entry.expiresAt - Date.now();
  return remainingMs <= 0 ? null : remainingMs / 1000;
}

