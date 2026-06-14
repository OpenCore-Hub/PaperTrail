import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";
import { register } from "@/lib/metrics";

function makeRequest(headers?: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost:3000/api/metrics", {
    headers,
  }) as NextRequest;
}

describe("GET /api/metrics", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    register.resetMetrics();
  });

  it("returns Prometheus text metrics", async () => {
    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain(
      "text/plain; version=0.0.4",
    );

    const body = await res.text();
    expect(body).toContain("dochub_");
    expect(body).toContain("# HELP");
  });

  it("returns 404 when metrics are disabled", async () => {
    vi.stubEnv("METRICS_ENABLED", "false");

    const res = await GET(makeRequest());
    expect(res.status).toBe(404);
  });

  it("requires a bearer token when METRICS_TOKEN is set", async () => {
    vi.stubEnv("METRICS_TOKEN", "secret-token");

    const resWithoutAuth = await GET(makeRequest());
    expect(resWithoutAuth.status).toBe(401);
    expect(resWithoutAuth.headers.get("WWW-Authenticate")).toBe("Bearer");

    const resWithWrongAuth = await GET(
      makeRequest({ Authorization: "Bearer wrong" }),
    );
    expect(resWithWrongAuth.status).toBe(401);

    const resWithCorrectAuth = await GET(
      makeRequest({ Authorization: "Bearer secret-token" }),
    );
    expect(resWithCorrectAuth.status).toBe(200);
  });
});
