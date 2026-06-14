import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

const { getServerSessionMock, documentFindFirstMock, shareLinkCreateMock } =
  vi.hoisted(() => ({
    getServerSessionMock: vi.fn(),
    documentFindFirstMock: vi.fn(),
    shareLinkCreateMock: vi.fn(),
  }));

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findFirst: documentFindFirstMock,
    },
    shareLink: {
      create: shareLinkCreateMock,
    },
  },
}));

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost:3000/api/share", {
    method: "POST",
    body: JSON.stringify(body),
  }) as NextRequest;
}

function mockSession(role: "ADMIN" | "EDITOR" | "VIEWER" = "ADMIN") {
  getServerSessionMock.mockResolvedValue({
    user: { id: "user-1", workspaceId: "ws-1", role },
  });
}

describe("POST /api/share", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated users", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await POST(makeRequest({ documentId: "doc-1" }));
    expect(res.status).toBe(401);
  });

  it("rejects VIEWER role", async () => {
    mockSession("VIEWER");
    const res = await POST(makeRequest({ documentId: "doc-1" }));
    expect(res.status).toBe(401);
  });

  it("creates a share link for an existing document", async () => {
    mockSession();
    const documentId = "550e8400-e29b-41d4-a716-446655440000";
    documentFindFirstMock.mockResolvedValue({ id: documentId });
    shareLinkCreateMock.mockResolvedValue({
      id: "link-1",
      slug: "abc123",
    });

    const res = await POST(makeRequest({ documentId }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.slug).toBe("abc123");
  });
});
