import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PATCH, DELETE } from "../route";

const {
  getServerSessionMock,
  userFindFirstMock,
  userCountMock,
  userUpdateMock,
  userDeleteMock,
} = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  userFindFirstMock: vi.fn(),
  userCountMock: vi.fn(),
  userUpdateMock: vi.fn(),
  userDeleteMock: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: userFindFirstMock,
      count: userCountMock,
      update: userUpdateMock,
      delete: userDeleteMock,
    },
  },
}));

function makeRequest(
  method: string,
  body?: object,
  id = "member-1",
): NextRequest {
  return new NextRequest(`http://localhost:3000/api/team/members/${id}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  }) as NextRequest;
}

function mockSession(role: "ADMIN" | "EDITOR" | "VIEWER" = "ADMIN") {
  getServerSessionMock.mockResolvedValue({
    user: { id: "user-1", workspaceId: "ws-1", role },
  });
}

describe("PATCH /api/team/members/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-admin users", async () => {
    mockSession("EDITOR");
    const res = await PATCH(makeRequest("PATCH", { role: "VIEWER" }), {
      params: { id: "member-1" },
    });
    expect(res.status).toBe(401);
  });

  it("rejects VIEWER self-target", async () => {
    // Sanity check: even a VIEWER hitting the endpoint is blocked before
    // reaching any target logic.
    getServerSessionMock.mockResolvedValue({
      user: { id: "user-1", workspaceId: "ws-1", role: "VIEWER" },
    });
    const res = await PATCH(makeRequest("PATCH", { role: "EDITOR" }), {
      params: { id: "member-1" },
    });
    expect(res.status).toBe(401);
  });

  it("updates a member role to VIEWER", async () => {
    mockSession();
    userFindFirstMock.mockResolvedValue({
      id: "member-1",
      role: "EDITOR",
    });
    userUpdateMock.mockResolvedValue({
      id: "member-1",
      email: "viewer@example.com",
      name: "Viewer User",
      role: "VIEWER",
    });

    const res = await PATCH(makeRequest("PATCH", { role: "VIEWER" }), {
      params: { id: "member-1" },
    });
    expect(res.status).toBe(200);
    expect(userUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "member-1" },
        data: { role: "VIEWER" },
        select: { id: true, email: true, name: true, role: true },
      }),
    );
  });

  it("prevents demoting the last admin", async () => {
    mockSession();
    userFindFirstMock.mockResolvedValue({
      id: "member-1",
      role: "ADMIN",
    });
    userCountMock.mockResolvedValue(1);

    const res = await PATCH(makeRequest("PATCH", { role: "VIEWER" }), {
      params: { id: "member-1" },
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("at least one admin");
    expect(userUpdateMock).not.toHaveBeenCalled();
  });

  it("returns 404 for members outside the workspace", async () => {
    mockSession();
    userFindFirstMock.mockResolvedValue(null);

    const res = await PATCH(makeRequest("PATCH", { role: "VIEWER" }), {
      params: { id: "member-1" },
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/team/members/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-admin users", async () => {
    mockSession("EDITOR");
    const res = await DELETE(makeRequest("DELETE"), {
      params: { id: "member-1" },
    });
    expect(res.status).toBe(401);
  });

  it("prevents self-removal", async () => {
    mockSession();
    userFindFirstMock.mockResolvedValue({
      id: "user-1",
      role: "ADMIN",
    });

    const res = await DELETE(makeRequest("DELETE"), {
      params: { id: "user-1" },
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("cannot remove yourself");
  });

  it("deletes a member", async () => {
    mockSession();
    userFindFirstMock.mockResolvedValue({
      id: "member-1",
      role: "EDITOR",
    });

    const res = await DELETE(makeRequest("DELETE"), {
      params: { id: "member-1" },
    });
    expect(res.status).toBe(200);
    expect(userDeleteMock).toHaveBeenCalledWith({ where: { id: "member-1" } });
  });
});
