import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "prom-client";
import { NextRequest, NextResponse } from "next/server";

/**
 * Shared Prometheus registry for DocHub application metrics.
 *
 * default metrics are collected (GC, event loop lag, memory, etc.) in addition
 * to custom business metrics.
 */
export const register = new Registry();

collectDefaultMetrics({ register });

/**
 * PDF proxy cache outcomes.
 */
export const pdfCacheCounter = new Counter({
  name: "dochub_pdf_cache_total",
  help: "Total number of PDF proxy requests by cache outcome",
  labelNames: ["outcome"] as const,
  registers: [register],
});

/**
 * Viewer analytics events by action type.
 */
export const viewEventCounter = new Counter({
  name: "dochub_view_event_total",
  help: "Total number of viewer analytics events by action",
  labelNames: ["action"] as const,
  registers: [register],
});

/**
 * Team invitation lifecycle events.
 */
export const teamInviteCounter = new Counter({
  name: "dochub_team_invite_total",
  help: "Total number of team invitation operations",
  labelNames: ["operation"] as const,
  registers: [register],
});

/**
 * Health check results.
 */
export const healthCheckCounter = new Counter({
  name: "dochub_health_check_total",
  help: "Total number of health check calls by status",
  labelNames: ["status"] as const,
  registers: [register],
});

/**
 * API request duration and outcome.
 *
 * This histogram is intended to be used in individual API routes where the
 * response status and timing are known.
 */
export const apiRequestHistogram = new Histogram({
  name: "dochub_api_request_duration_seconds",
  help: "API request duration in seconds",
  labelNames: ["route", "method", "status"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

/**
 * Record a single API request observation.
 */
export function recordApiRequest(
  route: string,
  method: string,
  status: number,
  startMs: number,
): void {
  const durationSeconds = (Date.now() - startMs) / 1000;
  apiRequestHistogram.observe(
    { route, method, status: status.toString() },
    durationSeconds,
  );
}

/**
 * Wrap a Next.js App Router handler so the request is recorded in the
 * {@link apiRequestHistogram}.
 *
 * The `route` label should be a stable route pattern such as `/api/health`.
 */
export function withMetrics<TArgs extends unknown[]>(
  route: string,
  handler: (...args: TArgs) => Promise<NextResponse>,
): (...args: TArgs) => Promise<NextResponse> {
  return async (...args) => {
    const req = args[0] as NextRequest | undefined;
    const method = req?.method ?? "GET";
    const start = Date.now();
    try {
      const res = await handler(...args);
      recordApiRequest(route, method, res.status, start);
      return res;
    } catch (error) {
      recordApiRequest(route, method, 500, start);
      throw error;
    }
  };
}
