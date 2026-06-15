import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

const {
  getServerSessionMock,
  dataroomFindFirstMock,
  dataroomFolderFindManyMock,
  dataroomFolderFindFirstMock,
  dataroomFolderCreateMock,
} = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  dataroomFindFirstMock: vi.fn(),
  dataroomFolderFindManyMock: vi.fn(),
  dataroomFolderFindFirstMock: vi.fn(),
  dataroomFolderCreateMock: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dataroom: { findFirst: dataroomFindFirstMock },
    dataroomFolder: {
      findMany: dataroomFolderFindManyMock,
      findFirst: dataroomFolderFindFirstMock,
      create: dataroomFolderCreateMock,
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  audit: vi.fn(),
}));

function mockSession(role: "ADMIN" | "EDITOR" | "VIEWER" = "ADMIN") {
  getServerSessionMock.mockResolvedValue({
    user: { id: "user-1", workspaceId: "ws-1", role },
  });
}

function makeRequest(
  id = "dr-1",
  body?: unknown,
  method: "GET" | "POST" = "GET",
): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/datarooms/${id}/folders`,
    {
      method,
      ...(body !== undefined && { body: JSON.stringify(body) }),
    },
  ) as NextRequest;
}

describe("GET /api/datarooms/[id]/folders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated users", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await GET(makeRequest(), { params: { id: "dr-1" } });
    expect(res.status).toBe(401);
  });

  it("lists folders", async () => {
    mockSession();
    dataroomFindFirstMock.mockResolvedValue({ id: "dr-1" });
    dataroomFolderFindManyMock.mockResolvedValue([{ id: "f-1", name: "Folder" }]);

    const res = await GET(makeRequest(), { params: { id: "dr-1" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.folders).toHaveLength(1);
  });

  it("returns 404 for dataroom outside workspace", async () => {
    mockSession();
    dataroomFindFirstMock.mockResolvedValue(null);
    const res = await GET(makeRequest(), { params: { id: "dr-1" } });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/datarooms/[id]/folders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a folder", async () => {
    mockSession();
    dataroomFindFirstMock.mockResolvedValue({ id: "dr-1" });
    dataroomFolderCreateMock.mockResolvedValue({ id: "f-1", name: "Folder" });

    const res = await POST(makeRequest("dr-1", { name: "Folder" }, "POST"), {
      params: { id: "dr-1" },
    });
    expect(res.status).toBe(201);
  });

  it("rejects VIEWER role", async () => {
    mockSession("VIEWER");
    const res = await POST(makeRequest("dr-1", { name: "Folder" }, "POST"), {
      params: { id: "dr-1" },
    });
    expect(res.status).toBe(401);
  });

  it("rejects parent folder outside the dataroom", async () => {
    mockSession();
    dataroomFindFirstMock.mockResolvedValue({ id: "dr-1" });
    dataroomFolderFindFirstMock.mockResolvedValue(null);

    const res = await POST(
      makeRequest("dr-1", { name: "Folder", parentId: "other" }, "POST"),
      { params: { id: "dr-1" } },
    );
    expect(res.status).toBe(400);
  });
});
