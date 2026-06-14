import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

const {
  shareLinkDeleteManyMock,
  viewSessionUpdateManyMock,
  viewSessionDeleteManyMock,
} = vi.hoisted(() => ({
  shareLinkDeleteManyMock: vi.fn(),
  viewSessionUpdateManyMock: vi.fn(),
  viewSessionDeleteManyMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shareLink: {
      deleteMany: shareLinkDeleteManyMock,
    },
    viewSession: {
      updateMany: viewSessionUpdateManyMock,
      deleteMany: viewSessionDeleteManyMock,
    },
  },
}));

function makeRequest(authHeader?: string): NextRequest {
  const headers = new Headers();
  if (authHeader) headers.set("authorization", authHeader);
  return new NextRequest("http://localhost:3000/api/cron/cleanup", {
    headers,
  });
}

describe("GET /api/cron/cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;
  });

  it("returns 503 when CRON_SECRET is not configured", async () => {
    const res = await GET(makeRequest("Bearer anything"));
    expect(res.status).toBe(503);
  });

  it("returns 401 when authorization header is missing", async () => {
    process.env.CRON_SECRET = "secret";
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 when token is invalid", async () => {
    process.env.CRON_SECRET = "secret";
    const res = await GET(makeRequest("Bearer wrong"));
    expect(res.status).toBe(401);
  });

  it("deletes expired links, closes stale sessions, and deletes old sessions when authenticated", async () => {
    process.env.CRON_SECRET = "secret";
    shareLinkDeleteManyMock.mockResolvedValue({ count: 5 });
    viewSessionUpdateManyMock.mockResolvedValue({ count: 3 });
    viewSessionDeleteManyMock.mockResolvedValue({ count: 12 });

    const res = await GET(makeRequest("Bearer secret"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.deletedExpiredLinks).toBe(5);
    expect(json.closedStaleSessions).toBe(3);
    expect(json.deletedOldSessions).toBe(12);

    expect(shareLinkDeleteManyMock).toHaveBeenCalledWith({
      where: {
        expiresAt: { not: null, lt: expect.any(Date) },
      },
    });
    expect(viewSessionUpdateManyMock).toHaveBeenCalledWith({
      where: {
        endedAt: null,
        startedAt: { lt: expect.any(Date) },
      },
      data: {
        endedAt: expect.any(Date),
      },
    });
    expect(viewSessionDeleteManyMock).toHaveBeenCalledWith({
      where: {
        startedAt: { lt: expect.any(Date) },
      },
    });
  });
});
