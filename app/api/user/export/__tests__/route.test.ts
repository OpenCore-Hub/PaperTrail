import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

function makeRequest(): NextRequest {
  return new NextRequest(
    "http://localhost:3000/api/user/export",
  ) as NextRequest;
}

const { getServerSessionMock, userFindUniqueMock } = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: userFindUniqueMock,
    },
  },
}));

function mockSession() {
  getServerSessionMock.mockResolvedValue({
    user: { id: "user-1", workspaceId: "ws-1", role: "ADMIN" },
  });
}

describe("GET /api/user/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated users", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 404 when user is not found", async () => {
    mockSession();
    userFindUniqueMock.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(404);
  });

  it("returns a JSON export with the correct filename", async () => {
    mockSession();
    userFindUniqueMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      name: "Test User",
      role: "ADMIN",
      emailVerified: new Date("2026-01-01"),
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-02"),
      workspace: {
        id: "ws-1",
        name: "Test Workspace",
        slug: "test-workspace",
        customDomain: null,
        customDomainVerifiedAt: null,
        plan: "free",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      },
      documents: [
        {
          id: "doc-1",
          filename: "Q2 Deck.pdf",
          storageKey: "file-key-123",
          fileSize: 1024,
          pageCount: 10,
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
          links: [
            {
              id: "link-1",
              slug: "abc123",
              expiresAt: null,
              emailGate: false,
              allowDownload: false,
              createdAt: new Date("2026-01-01"),
              updatedAt: new Date("2026-01-01"),
              sessions: [
                {
                  id: "session-1",
                  fingerprint: "fp-1",
                  viewerEmail: "viewer@example.com",
                  startedAt: new Date("2026-01-01"),
                  endedAt: null,
                  durationSeconds: 45,
                  pageViews: [
                    {
                      id: "pv-1",
                      pageNumber: 1,
                      enteredAt: new Date("2026-01-01"),
                      durationSeconds: 20,
                    },
                  ],
                },
              ],
              viewerGrants: [],
            },
          ],
        },
      ],
      passwordResetTokens: [],
      emailVerificationTokens: [],
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("Content-Disposition")).toContain(
      'attachment; filename="dochub-export-user-1.json"',
    );

    const json = await res.json();
    expect(json.user.id).toBe("user-1");
    expect(json.user.email).toBe("user@example.com");
    expect(json.workspace?.name).toBe("Test Workspace");
    expect(json.documents).toHaveLength(1);
    expect(json.documents[0].links[0].sessions[0].pageViews[0].pageNumber).toBe(
      1,
    );
    expect(json.exportedAt).toBeDefined();
  });
});
