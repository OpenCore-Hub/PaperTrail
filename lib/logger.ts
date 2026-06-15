import pino from "pino";
import { getRequestContext } from "./async-context";

/**
 * Shared Pino logger factory.
 *
 * Outputs newline-delimited JSON for production log aggregation systems
 * (CloudWatch, Datadog, etc.). In development you can pipe the process output
 * through `pino-pretty` for human-readable formatting, e.g.:
 *
 *   npm run dev | npx pino-pretty
 */
export function createLogger(name: string) {
  return pino({
    name,
    level: process.env.LOG_LEVEL ?? "info",
  });
}

/**
 * Request-scoped logger that automatically includes the current requestId,
 * userId, IP, and path when called inside a request context.
 *
 * Use this inside API route handlers (wrapped with `withRequestContext`) so
 * every log line from the same request is correlated.
 */
export function getRequestLogger(name: string) {
  const base = createLogger(name);
  const context = getRequestContext();

  if (!context) {
    return base;
  }

  return base.child({
    requestId: context.requestId,
    userId: context.userId,
    ip: context.ip,
    path: context.path,
  });
}

/**
 * Default application logger.
 */
export const log = createLogger("dochub");
