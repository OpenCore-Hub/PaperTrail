import { NextRequest, NextResponse } from "next/server";
import { register } from "@/lib/metrics";
import { createLogger } from "@/lib/logger";

const log = createLogger("api:metrics");

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Return Prometheus metrics in text format.
 *
 * Authentication is controlled by `METRICS_TOKEN`:
 * - If set, requests must include `Authorization: Bearer <METRICS_TOKEN>`.
 * - If unset, the endpoint is open. This is convenient for local development
 *   but should be protected by a reverse proxy in production.
 *
 * Set `METRICS_ENABLED=false` to disable the endpoint entirely.
 */
export async function GET(req: NextRequest) {
  if (process.env.METRICS_ENABLED === "false") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const expectedToken = process.env.METRICS_TOKEN;
  if (expectedToken) {
    const authHeader = req.headers.get("authorization") ?? "";
    const providedToken = authHeader.replace(/^Bearer\s+/i, "");
    if (providedToken !== expectedToken) {
      log.warn({ ip: req.ip ?? "unknown" }, "metrics.unauthorized_access");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
      );
    }
  }

  try {
    const metrics = await register.metrics();
    return new NextResponse(metrics, {
      status: 200,
      headers: {
        "Content-Type": register.contentType,
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    log.error({ error: detail }, "metrics.render_failed");
    return NextResponse.json(
      { error: "Failed to render metrics" },
      { status: 500 },
    );
  }
}
