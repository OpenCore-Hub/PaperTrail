import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  register,
  pdfCacheCounter,
  viewEventCounter,
  teamInviteCounter,
  healthCheckCounter,
  withMetrics,
  recordApiRequest,
} from "@/lib/metrics";

describe("metrics", () => {
  beforeEach(() => {
    register.resetMetrics();
  });

  it("increments custom counters", async () => {
    pdfCacheCounter.inc({ outcome: "hit" });
    pdfCacheCounter.inc({ outcome: "miss" });
    viewEventCounter.inc({ action: "start" });
    teamInviteCounter.inc({ operation: "created" });
    healthCheckCounter.inc({ status: "ok" });

    expect(
      await getCounterValue("dochub_pdf_cache_total", { outcome: "hit" }),
    ).toBe(1);
    expect(
      await getCounterValue("dochub_pdf_cache_total", { outcome: "miss" }),
    ).toBe(1);
    expect(
      await getCounterValue("dochub_view_event_total", { action: "start" }),
    ).toBe(1);
    expect(
      await getCounterValue("dochub_team_invite_total", {
        operation: "created",
      }),
    ).toBe(1);
    expect(
      await getCounterValue("dochub_health_check_total", { status: "ok" }),
    ).toBe(1);
  });

  it("records API request durations via recordApiRequest", async () => {
    recordApiRequest("/api/health", "GET", 200, Date.now() - 50);

    const value = await getHistogramSum("dochub_api_request_duration_seconds", {
      route: "/api/health",
      method: "GET",
      status: "200",
    });

    expect(value).toBeGreaterThanOrEqual(0.04);
    expect(value).toBeLessThan(0.1);
  });

  it("wraps handlers and records success status", async () => {
    const handler = withMetrics(
      "/api/health",
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async (_req: NextRequest) => {
        return NextResponse.json({ ok: true }, { status: 200 });
      },
    );

    const req = new NextRequest(
      "http://localhost:3000/api/health",
    ) as NextRequest;
    const res = await handler(req);

    expect(res.status).toBe(200);
    expect(
      await getHistogramCount("dochub_api_request_duration_seconds", {
        route: "/api/health",
        method: "GET",
        status: "200",
      }),
    ).toBe(1);
  });

  it("wraps handlers and records error status on thrown errors", async () => {
    const handler = withMetrics(
      "/api/health",
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async (_req: NextRequest) => {
        throw new Error("boom");
      },
    );

    const req = new NextRequest("http://localhost:3000/api/health", {
      method: "POST",
    }) as NextRequest;

    await expect(handler(req)).rejects.toThrow("boom");
    expect(
      await getHistogramCount("dochub_api_request_duration_seconds", {
        route: "/api/health",
        method: "POST",
        status: "500",
      }),
    ).toBe(1);
  });
});

async function getCounterValue(
  name: string,
  labels: Record<string, string>,
): Promise<number> {
  const metricsText = await register.metrics();
  const labelSelector = Object.entries(labels)
    .map(([k, v]) => `${k}="${v}"`)
    .join(",");
  const regex = new RegExp(
    `${name}\{${labelSelector}(?:,[^}]*)?\}\\s+(\\d+(?:\\.\\d+)?)`,
    "m",
  );
  const match = metricsText.match(regex);
  return match ? Number(match[1]) : 0;
}

async function getHistogramSum(
  name: string,
  labels: Record<string, string>,
): Promise<number> {
  const metricsText = await register.metrics();
  const labelSelector = Object.entries(labels)
    .map(([k, v]) => `${k}="${v}"`)
    .join(",");
  const regex = new RegExp(
    `${name}_sum\{${labelSelector}(?:,[^}]*)?\}\\s+(\\d+(?:\\.\\d+)?)`,
    "m",
  );
  const match = metricsText.match(regex);
  return match ? Number(match[1]) : 0;
}

async function getHistogramCount(
  name: string,
  labels: Record<string, string>,
): Promise<number> {
  const metricsText = await register.metrics();
  const labelSelector = Object.entries(labels)
    .map(([k, v]) => `${k}="${v}"`)
    .join(",");
  const regex = new RegExp(
    `${name}_count\{${labelSelector}(?:,[^}]*)?\}\\s+(\\d+)`,
    "m",
  );
  const match = metricsText.match(regex);
  return match ? Number(match[1]) : 0;
}
