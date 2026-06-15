import Redis from "ioredis";
import { createLogger } from "@/lib/logger";

const log = createLogger("account-lockout");

const MAX_FAILED_ATTEMPTS = 5;
const FAIL_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export interface LockoutStatus {
  allowed: boolean;
  lockedUntil?: number;
}

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
      log.error({ error: err.message }, "account_lockout.redis_error");
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log.error({ error: message }, "account_lockout.redis_init_failed");
    redisClient = null;
  }

  return redisClient;
}

function lockKey(email: string): string {
  return `login-lock:${email}`;
}

function failKey(email: string): string {
  return `login-fail:${email}`;
}

async function isAllowedRedis(
  email: string,
  client: Redis,
): Promise<LockoutStatus> {
  const pipeline = client.pipeline();
  pipeline.get(lockKey(email));
  pipeline.pttl(lockKey(email));
  pipeline.get(failKey(email));

  const results = await pipeline.exec();
  if (!results) {
    return { allowed: true };
  }

  const [[, lockValue], [, lockTtl], [, failCount]] = results as [
    [Error | null, string | null],
    [Error | null, number],
    [Error | null, string | null],
  ];

  if (lockValue) {
    const until = Date.now() + Math.max(lockTtl, 0);
    return { allowed: false, lockedUntil: until };
  }

  const count = Number(failCount) || 0;
  if (count >= MAX_FAILED_ATTEMPTS) {
    await client.set(lockKey(email), "1", "PX", LOCKOUT_DURATION_MS);
    return { allowed: false, lockedUntil: Date.now() + LOCKOUT_DURATION_MS };
  }

  return { allowed: true };
}

async function recordFailedLoginRedis(
  email: string,
  client: Redis,
): Promise<void> {
  const count = await client.incr(failKey(email));

  if (count === 1) {
    await client.pexpire(failKey(email), FAIL_WINDOW_MS);
  }

  if (count >= MAX_FAILED_ATTEMPTS) {
    await client.set(lockKey(email), "1", "PX", LOCKOUT_DURATION_MS);
  }
}

async function clearFailedLoginsRedis(
  email: string,
  client: Redis,
): Promise<void> {
  await client.del(lockKey(email), failKey(email));
}

interface MemoryEntry {
  count: number;
  resetAt: number;
}

const memoryFails = new Map<string, MemoryEntry>();
const memoryLocks = new Map<string, number>();

function isAllowedMemory(email: string): LockoutStatus {
  const now = Date.now();
  const lockUntil = memoryLocks.get(email);

  if (lockUntil) {
    if (lockUntil > now) {
      return { allowed: false, lockedUntil: lockUntil };
    }
    memoryLocks.delete(email);
  }

  const entry = memoryFails.get(email);
  if (entry) {
    if (entry.resetAt <= now) {
      memoryFails.delete(email);
    } else if (entry.count >= MAX_FAILED_ATTEMPTS) {
      const until = now + LOCKOUT_DURATION_MS;
      memoryLocks.set(email, until);
      memoryFails.delete(email);
      return { allowed: false, lockedUntil: until };
    }
  }

  return { allowed: true };
}

function recordFailedLoginMemory(email: string): void {
  const now = Date.now();
  const entry = memoryFails.get(email);

  if (!entry || entry.resetAt <= now) {
    memoryFails.set(email, { count: 1, resetAt: now + FAIL_WINDOW_MS });
    return;
  }

  entry.count += 1;

  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    memoryLocks.set(email, now + LOCKOUT_DURATION_MS);
    memoryFails.delete(email);
  }
}

function clearFailedLoginsMemory(email: string): void {
  memoryFails.delete(email);
  memoryLocks.delete(email);
}

export async function isLoginAllowed(email: string): Promise<LockoutStatus> {
  const client = getRedisClient();

  if (client) {
    try {
      return await isAllowedRedis(email, client);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      log.error({ error: message }, "account_lockout.redis_check_failed");
    }
  }

  return isAllowedMemory(email);
}

export async function recordFailedLogin(email: string): Promise<void> {
  const client = getRedisClient();

  if (client) {
    try {
      await recordFailedLoginRedis(email, client);
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      log.error({ error: message }, "account_lockout.redis_record_failed");
    }
  }

  recordFailedLoginMemory(email);
}

export async function clearFailedLogins(email: string): Promise<void> {
  const client = getRedisClient();

  if (client) {
    try {
      await clearFailedLoginsRedis(email, client);
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      log.error({ error: message }, "account_lockout.redis_clear_failed");
    }
  }

  clearFailedLoginsMemory(email);
}
