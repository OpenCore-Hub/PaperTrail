import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { healthCheckCounter, withMetrics } from "@/lib/metrics";

const log = createLogger("api:health");

export const dynamic = "force-dynamic";

interface HealthCheck {
  name: string;
  status: "ok" | "error";
  detail?: string;
}

async function checkDatabase(): Promise<HealthCheck> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { name: "database", status: "ok" };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    log.error({ error: detail }, "health.database_check_failed");
    return { name: "database", status: "error", detail };
  }
}

async function checkStorage(): Promise<HealthCheck> {
  // Avoid calling UploadThing on every health check: it can be slow, rate
  // limited, and is outside our control plane. Instead verify that the token
  // is configured, which is the only thing the application can guarantee.
  const token = process.env.UPLOADTHING_TOKEN;
  if (!token) {
    return {
      name: "storage",
      status: "error",
      detail: "UPLOADTHING_TOKEN is not configured",
    };
  }
  return { name: "storage", status: "ok" };
}

async function handler() {
  const checks = await Promise.all([checkDatabase(), checkStorage()]);
  const healthy = checks.every((c) => c.status === "ok");

  healthCheckCounter.inc({ status: healthy ? "ok" : "degraded" });

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      checks: checks.reduce(
        (acc, check) => {
          acc[check.name] = {
            status: check.status,
            ...(check.detail ? { detail: check.detail } : {}),
          };
          return acc;
        },
        {} as Record<string, { status: string; detail?: string }>,
      ),
    },
    { status: healthy ? 200 : 503 },
  );
}

export const GET = withMetrics("/api/health", handler);
