import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

const {
  getServerSessionMock,
  userFindUniqueMock,
  userDeleteMock,
  bcryptCompareMock,
} = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  userDeleteMock: vi.fn(),
  bcryptCompareMock: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: userFindUniqueMock,
      delete: userDeleteMock,
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: bcryptCompareMock,
  },
  compare: bcryptCompareMock,
}));

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost:3000/api/user/delete", {
    method: "POST",
    body: JSON.stringify(body),
  }) as NextRequest;
}

function mockSession() {
  getServerSessionMock.mockResolvedValue({
    user: { id: "user-1", workspaceId: "ws-1", role: "ADMIN" },
  });
}

describe("POST /api/user/delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated users", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await POST(makeRequest({ password: "password123" }));
    expect(res.status).toBe(401);
  });

  it("returns 404 when user is not found", async () => {
    mockSession();
    userFindUniqueMock.mockResolvedValue(null);
    const res = await POST(makeRequest({ password: "password123" }));
    expect(res.status).toBe(404);
  });

  it("rejects Google-only users without a password", async () => {
    mockSession();
    userFindUniqueMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      password: null,
    });

    const res = await POST(makeRequest({ password: "password123" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("without a password");
    expect(userDeleteMock).not.toHaveBeenCalled();
  });

  it("rejects deletion with the wrong password", async () => {
    mockSession();
    userFindUniqueMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      password: "hashed-password",
    });
    bcryptCompareMock.mockResolvedValue(false);

    const res = await POST(makeRequest({ password: "wrong-password" }));
    expect(res.status).toBe(401);
    expect(bcryptCompareMock).toHaveBeenCalledWith(
      "wrong-password",
      "hashed-password",
    );
    expect(userDeleteMock).not.toHaveBeenCalled();
  });

  it("deletes the user when the password is correct", async () => {
    mockSession();
    userFindUniqueMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      password: "hashed-password",
    });
    bcryptCompareMock.mockResolvedValue(true);
    userDeleteMock.mockResolvedValue({ id: "user-1" });

    const res = await POST(makeRequest({ password: "password123" }));
    expect(res.status).toBe(200);
    expect(userDeleteMock).toHaveBeenCalledWith({ where: { id: "user-1" } });
  });

  it("returns 400 for invalid input", async () => {
    mockSession();
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });
});
