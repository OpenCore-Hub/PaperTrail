import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, PATCH, DELETE } from "../route";

const {
  getServerSessionMock,
  findFirstMock,
  updateMock,
  deleteMock,
} = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  findFirstMock: vi.fn(),
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shareLink: {
      findFirst: findFirstMock,
      update: updateMock,
      delete: deleteMock,
    },
  },
}));

function makeRequest(
  method: string,
  body?: object,
  id = "link-1",
): NextRequest {
  return new NextRequest(`http://localhost:3000/api/share/${id}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  }) as NextRequest;
}

function mockSession(role: "ADMIN" | "EDITOR" = "ADMIN") {
  getServerSessionMock.mockResolvedValue({
    user: { id: "user-1", workspaceId: "ws-1", role },
  });
}

function mockLink(overrides: object = {}) {
  findFirstMock.mockResolvedValue({
    id: "link-1",
    slug: "abc123",
    passwordHash: null,
    expiresAt: null,
    emailGate: false,
    allowDownload: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    document: { workspaceId: "ws-1" },
    ...overrides,
  });
}

describe("GET /api/share/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated users", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await GET(makeRequest("GET"), { params: { id: "link-1" } });
    expect(res.status).toBe(401);
  });

  it("returns 404 when link is in another workspace", async () => {
    mockSession();
    findFirstMock.mockResolvedValue(null);
    const res = await GET(makeRequest("GET"), { params: { id: "link-1" } });
    expect(res.status).toBe(404);
  });

  it("returns link details excluding password hash", async () => {
    mockSession();
    mockLink({ passwordHash: "hashed" });
    const res = await GET(makeRequest("GET"), { params: { id: "link-1" } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.link.hasPassword).toBe(true);
    expect(json.link).not.toHaveProperty("passwordHash");
  });
});

describe("PATCH /api/share/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated users", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await PATCH(makeRequest("PATCH", { emailGate: true }), {
      params: { id: "link-1" },
    });
    expect(res.status).toBe(401);
  });

  it("updates toggles without changing password", async () => {
    mockSession();
    mockLink();
    updateMock.mockResolvedValue({
      id: "link-1",
      slug: "abc123",
      passwordHash: null,
      expiresAt: null,
      emailGate: true,
      allowDownload: true,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-02"),
    });

    const res = await PATCH(
      makeRequest("PATCH", { emailGate: true, allowDownload: true }),
      { params: { id: "link-1" } },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.link.emailGate).toBe(true);
    expect(json.link.allowDownload).toBe(true);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ passwordHash: expect.anything() }),
      }),
    );
  });

  it("hashes a new password when provided", async () => {
    mockSession();
    mockLink();
    updateMock.mockImplementation(({ data }) =>
      Promise.resolve({
        id: "link-1",
        slug: "abc123",
        passwordHash: data.passwordHash,
        expiresAt: null,
        emailGate: false,
        allowDownload: false,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-02"),
      }),
    );

    const res = await PATCH(makeRequest("PATCH", { password: "secret" }), {
      params: { id: "link-1" },
    });
    expect(res.status).toBe(200);
    const call = updateMock.mock.calls[0][0];
    expect(call.data.passwordHash).toBeDefined();
    expect(call.data.passwordHash).not.toBe("secret");
  });

  it("removes password when empty string is sent", async () => {
    mockSession();
    mockLink({ passwordHash: "hashed" });
    updateMock.mockImplementation(({ data }) =>
      Promise.resolve({
        id: "link-1",
        slug: "abc123",
        passwordHash: data.passwordHash,
        expiresAt: null,
        emailGate: false,
        allowDownload: false,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-02"),
      }),
    );

    const res = await PATCH(makeRequest("PATCH", { password: "" }), {
      params: { id: "link-1" },
    });
    expect(res.status).toBe(200);
    const call = updateMock.mock.calls[0][0];
    expect(call.data.passwordHash).toBeNull();
  });
});

describe("DELETE /api/share/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated users", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await DELETE(makeRequest("DELETE"), { params: { id: "link-1" } });
    expect(res.status).toBe(401);
  });

  it("deletes the link", async () => {
    mockSession();
    mockLink();
    const res = await DELETE(makeRequest("DELETE"), { params: { id: "link-1" } });
    expect(res.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "link-1" } });
  });
});
