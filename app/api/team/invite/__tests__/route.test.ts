import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

const {
  getServerSessionMock,
  userFindUniqueMock,
  inviteFindUniqueMock,
  inviteUpsertMock,
} = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  inviteFindUniqueMock: vi.fn(),
  inviteUpsertMock: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: userFindUniqueMock,
    },
    workspaceInvite: {
      findUnique: inviteFindUniqueMock,
      upsert: inviteUpsertMock,
    },
  },
}));

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost:3000/api/team/invite", {
    method: "POST",
    body: JSON.stringify(body),
  }) as NextRequest;
}

describe("POST /api/team/invite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_URL = "http://localhost:3000";
  });

  function mockAdminSession() {
    getServerSessionMock.mockResolvedValue({
      user: { workspaceId: "ws-1", role: "ADMIN" },
    });
  }

  it("rejects non-admin users", async () => {
    getServerSessionMock.mockResolvedValue({
      user: { workspaceId: "ws-1", role: "EDITOR" },
    });

    const res = await POST(makeRequest({ email: "a@b.com", role: "EDITOR" }));
    expect(res.status).toBe(401);
  });

  it("rejects when user already belongs to a workspace", async () => {
    mockAdminSession();
    userFindUniqueMock.mockResolvedValue({ id: "existing-user" });

    const res = await POST(makeRequest({ email: "a@b.com", role: "EDITOR" }));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toContain("already belongs");
  });

  it("creates an invite for a new email", async () => {
    mockAdminSession();
    userFindUniqueMock.mockResolvedValue(null);
    inviteFindUniqueMock.mockResolvedValue(null);
    inviteUpsertMock.mockResolvedValue({
      id: "invite-1",
      email: "new@example.com",
      role: "EDITOR",
      token: "secure-token-123",
      expiresAt: new Date("2099-01-01"),
    });

    const res = await POST(
      makeRequest({ email: "new@example.com", role: "EDITOR" }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.invite.email).toBe("new@example.com");
    expect(json.invite.inviteUrl).toContain("token=secure-token-123");
  });
});
