import Redis from "ioredis";

export interface RateLimitWindow {
  maxRequests: number;
  windowMs: number;
}

interface BucketEntry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, BucketEntry>();

let redisClient: Redis | null = null;
let redisChecked = false;

function getRedisClient(): Redis | null {
  if (redisChecked) return redisClient;
  redisChecked = true;

  const url = process.env.REDIS_URL;
  if (!url) {
    return null;
  }

  try {
    redisClient = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
    });

    redisClient.on("error", (err) => {
      // Log but do not crash the process; the next call will fall back to
      // memory if the connection is unavailable.
      console.error("Redis rate limiter error:", err.message);
    });
  } catch (err) {
    console.error("Failed to create Redis client for rate limiting:", err);
    redisClient = null;
  }

  return redisClient;
}

async function isAllowedRedis(
  key: string,
  window: RateLimitWindow,
  client: Redis,
): Promise<boolean> {
  const count = await client.incr(key);

  // Set expiry only on the first request in the window. Using pexpire keeps
  // the TTL close to the configured window size.
  if (count === 1) {
    await client.pexpire(key, window.windowMs);
  }

  return count <= window.maxRequests;
}

function isAllowedMemory(key: string, window: RateLimitWindow): boolean {
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
 * Check whether a request is allowed under the given key and window.
 * Returns true if allowed, false if rate-limited.
 *
 * If `REDIS_URL` is configured, Redis is used so the window is shared across
 * processes/instances. Otherwise an in-memory store is used as a fallback
 * (suitable for single-instance deployments and tests).
 */
export async function isAllowed(
  key: string,
  window: RateLimitWindow,
): Promise<boolean> {
  const client = getRedisClient();

  if (client) {
    try {
      return await isAllowedRedis(key, window, client);
    } catch (err) {
      console.error("Redis rate limit failed, falling back to memory:", err);
    }
  }

  return isAllowedMemory(key, window);
}

/**
 * Reset all in-memory buckets. Intended for tests only.
 */
export function resetRateLimits(): void {
  buckets.clear();
}
