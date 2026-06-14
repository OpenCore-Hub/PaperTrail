/**
 * Simple in-memory sliding-window rate limiter.
 *
 * This is suitable for single-instance deployments (e.g. a single Docker
 * container or `next start` on one VM). For serverless or multi-instance
 * deployments, replace this with a Redis-backed limiter so the window is
 * shared across processes.
 */

export interface RateLimitWindow {
  maxRequests: number;
  windowMs: number;
}

interface BucketEntry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, BucketEntry>();

/**
 * Check whether a request is allowed under the given key and window.
 * Returns true if allowed, false if rate-limited.
 */
export function isAllowed(key: string, window: RateLimitWindow): boolean {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || entry.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + window.windowMs,
    });
    return true;
  }

  if (entry.count >= window.maxRequests) {
    return false;
  }

  entry.count += 1;
  return true;
}

/**
 * Reset all buckets. Intended for tests only.
 */
export function resetRateLimits(): void {
  buckets.clear();
}
