import pino from "pino";

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
 * Default application logger.
 */
export const log = createLogger("dochub");
