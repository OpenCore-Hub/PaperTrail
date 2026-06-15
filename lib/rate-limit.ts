import Redis from "ioredis";
import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "./ip";

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

export function getRedisClient(): Redis | null {
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

interface RateLimitResult {
  allowed: boolean;
  response: NextResponse | null;
}

/**
 * Build a rate-limit key from a request. Uses the authenticated user id when
 * available, otherwise falls back to the client IP.
 */
export function getRateLimitKey(
  req: NextRequest,
  prefix: string,
  sessionUserId?: string,
): string {
  const source = sessionUserId || getClientIp(req) || "unknown";
  return `${prefix}:${source}`;
}

/**
 * Enforce a rate limit and return a standard 429 response when exceeded.
 */
export async function enforceRateLimit(
  req: NextRequest,
  prefix: string,
  window: RateLimitWindow,
  sessionUserId?: string,
): Promise<RateLimitResult> {
  const key = getRateLimitKey(req, prefix, sessionUserId);
  const allowed = await isAllowed(key, window);
  if (!allowed) {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 },
      ),
    };
  }
  return { allowed: true, response: null };
}

/**
 * Common rate-limit windows used across the application.
 */
export const RateLimits = {
  auth: { maxRequests: 10, windowMs: 60 * 60 * 1000 }, // 10 per hour per IP
  passwordVerify: { maxRequests: 10, windowMs: 15 * 60 * 1000 }, // existing viewer verify limit
  invite: { maxRequests: 30, windowMs: 60 * 60 * 1000 }, // 30 invites per admin per hour
  shareMutation: { maxRequests: 120, windowMs: 60 * 60 * 1000 }, // 120 mutations per user per hour
  documentMutation: { maxRequests: 60, windowMs: 60 * 60 * 1000 },
  viewerEvent: { maxRequests: 60, windowMs: 60 * 1000 }, // existing
  viewerStart: { maxRequests: 20, windowMs: 60 * 1000 }, // existing
} as const;
