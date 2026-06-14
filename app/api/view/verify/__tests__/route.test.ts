import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import { resetRateLimits } from "@/lib/rate-limit";

const { shareLinkFindUniqueMock } = vi.hoisted(() => ({
  shareLinkFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shareLink: {
      findUnique: shareLinkFindUniqueMock,
    },
    viewerGrant: {
      create: vi.fn(),
    },
  },
}));

function makeRequest(
  body: object,
  headers?: Record<string, string>,
): NextRequest {
  return new NextRequest("http://localhost:3000/api/view/verify", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }) as NextRequest;
}

describe("POST /api/view/verify rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimits();
  });

  it("returns 429 after too many attempts for the same link and IP", async () => {
    shareLinkFindUniqueMock.mockResolvedValue({
      id: "link-1",
      passwordHash: null,
      expiresAt: null,
      emailGate: false,
    });

    const linkId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const body = { linkId };
    const headers = { "x-forwarded-for": "1.2.3.4" };

    // The limit is 10 per 15 minutes.
    for (let i = 0; i < 10; i++) {
      const res = await POST(makeRequest(body, headers));
      expect(res.status).not.toBe(429);
    }

    const res = await POST(makeRequest(body, headers));
    expect(res.status).toBe(429);
  });

  it("tracks different IPs independently", async () => {
    const linkId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    shareLinkFindUniqueMock.mockResolvedValue({
      id: linkId,
      passwordHash: null,
      expiresAt: null,
      emailGate: false,
    });

    const body = { linkId };

    for (let i = 0; i < 10; i++) {
      await POST(makeRequest(body, { "x-forwarded-for": "1.2.3.4" }));
    }

    const otherIp = await POST(
      makeRequest(body, { "x-forwarded-for": "5.6.7.8" }),
    );
    expect(otherIp.status).not.toBe(429);
  });
});
