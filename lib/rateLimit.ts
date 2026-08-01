const requestBuckets = new Map<string, number[]>();

export function isRateLimited(key: string, maxRequests = 20, windowMs = 60_000) {
  const now = Date.now();
  const timestamps = requestBuckets.get(key) ?? [];
  const recent = timestamps.filter((stamp) => now - stamp < windowMs);
  requestBuckets.set(key, recent);

  if (recent.length >= maxRequests) {
    return true;
  }

  recent.push(now);
  return false;
}
