import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import {
  getRequestContext,
  runWithRequestContext,
  setRequestUserId,
} from "@/lib/async-context";

function makeRequest(headers?: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost:3000/api/test", {
    headers,
  }) as NextRequest;
}

describe("request context", () => {
  it("inherits x-request-id from the incoming request", async () => {
    await runWithRequestContext(
      makeRequest({ "x-request-id": "abc-123" }),
      async () => {
        expect(getRequestContext()?.requestId).toBe("abc-123");
      },
    );
  });

  it("generates a request id when none is provided", async () => {
    await runWithRequestContext(makeRequest(), async () => {
      const requestId = getRequestContext()?.requestId;
      expect(requestId).toBeDefined();
      expect(requestId).not.toBe("");
    });
  });

  it("captures the request path and client ip", async () => {
    await runWithRequestContext(
      makeRequest({ "x-forwarded-for": "1.2.3.4" }),
      async () => {
        expect(getRequestContext()?.path).toBe("/api/test");
        expect(getRequestContext()?.ip).toBe("1.2.3.4");
      },
    );
  });

  it("allows setting the actor user id", async () => {
    await runWithRequestContext(makeRequest(), async () => {
      setRequestUserId("user-1");
      expect(getRequestContext()?.userId).toBe("user-1");
    });
  });
});
