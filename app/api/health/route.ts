import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    return { name: "database", status: "error", detail };
  }
}

async function checkStorage(): Promise<HealthCheck> {
  try {
    const { UTApi } = await import("uploadthing/server");
    const utapi = new UTApi();
    // List files with a small limit as a lightweight connectivity check.
    // This only verifies API reachability, not full upload/download.
    await utapi.listFiles({ limit: 1 });
    return { name: "storage", status: "ok" };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return { name: "storage", status: "error", detail };
  }
}

export async function GET() {
  const checks = await Promise.all([checkDatabase(), checkStorage()]);
  const healthy = checks.every((c) => c.status === "ok");

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
