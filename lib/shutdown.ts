import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";

const log = createLogger("shutdown");

let shuttingDown = false;

export function isShuttingDown(): boolean {
  return shuttingDown;
}

const SHUTDOWN_TIMEOUT_MS = 10_000;

export async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  log.info({ signal }, "shutdown.started");

  const timeout = setTimeout(() => {
    log.error(
      { signal, timeoutMs: SHUTDOWN_TIMEOUT_MS },
      "shutdown.timeout_forcing_exit",
    );
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  try {
    // Lazy-load the Redis client so this module can be imported by edge-safe
    // code without pulling in ioredis at build time.
    const { getRedisClient } = await import("@/lib/rate-limit");
    const redis = getRedisClient();
    if (redis) {
      await redis.quit();
      log.info({}, "shutdown.redis_closed");
    }

    await prisma.$disconnect();
    log.info({}, "shutdown.prisma_disconnected");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error({ error: message }, "shutdown.cleanup_failed");
  } finally {
    clearTimeout(timeout);
  }

  process.exit(0);
}

export function registerShutdownHandlers(): void {
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
}
