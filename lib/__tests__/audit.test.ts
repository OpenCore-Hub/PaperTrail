import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { audit } from "@/lib/audit";
import { runWithRequestContext } from "@/lib/async-context";

const infoMock = vi.fn();

vi.mock("@/lib/logger", () => ({
  getRequestLogger: vi.fn(() => ({
    info: infoMock,
  })),
}));

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/test") as NextRequest;
}

describe("audit", () => {
  it("writes an audit event with request context", async () => {
    await runWithRequestContext(makeRequest(), async () => {
      audit("user.deleted", { userId: "user-1" });
    });

    expect(infoMock).toHaveBeenCalledTimes(1);
    const payload = infoMock.mock.calls[0][0];
    expect(payload.event).toBe("user.deleted");
    expect(payload.userId).toBe("user-1");
    expect(payload.requestId).toBeDefined();
    expect(payload.ip).toBeDefined();
  });
});
