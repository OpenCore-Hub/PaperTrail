import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, PATCH, DELETE } from "../route";

const {
  getServerSessionMock,
  dataroomFindFirstMock,
  dataroomUpdateMock,
  dataroomDeleteMock,
} = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  dataroomFindFirstMock: vi.fn(),
  dataroomUpdateMock: vi.fn(),
  dataroomDeleteMock: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dataroom: {
      findFirst: dataroomFindFirstMock,
      update: dataroomUpdateMock,
      delete: dataroomDeleteMock,
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
  method: "GET" | "PATCH" | "DELETE" = "GET",
): NextRequest {
  return new NextRequest(`http://localhost:3000/api/datarooms/${id}`, {
    method,
    ...(body !== undefined && { body: JSON.stringify(body) }),
  }) as NextRequest;
}

describe("GET /api/datarooms/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated users", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await GET(makeRequest(), { params: { id: "dr-1" } });
    expect(res.status).toBe(401);
  });

  it("returns 404 for dataroom outside workspace", async () => {
    mockSession();
    dataroomFindFirstMock.mockResolvedValue(null);
    const res = await GET(makeRequest(), { params: { id: "dr-1" } });
    expect(res.status).toBe(404);
  });

  it("returns dataroom with folders and documents", async () => {
    mockSession();
    dataroomFindFirstMock.mockResolvedValue({
      id: "dr-1",
      name: "Investor",
      folders: [],
      documents: [],
    });

    const res = await GET(makeRequest(), { params: { id: "dr-1" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.dataroom.id).toBe("dr-1");
  });
});

describe("PATCH /api/datarooms/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates name and description", async () => {
    mockSession();
    dataroomFindFirstMock.mockResolvedValue({ id: "dr-1", name: "Old" });
    dataroomUpdateMock.mockResolvedValue({
      id: "dr-1",
      name: "New",
      description: "Desc",
      folders: [],
      documents: [],
    });

    const res = await PATCH(
      makeRequest("dr-1", { name: "New", description: "Desc" }, "PATCH"),
      { params: { id: "dr-1" } },
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.dataroom.name).toBe("New");
  });

  it("rejects VIEWER updates", async () => {
    mockSession("VIEWER");
    const res = await PATCH(
      makeRequest("dr-1", { name: "New" }, "PATCH"),
      { params: { id: "dr-1" } },
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when dataroom missing", async () => {
    mockSession();
    dataroomFindFirstMock.mockResolvedValue(null);
    const res = await PATCH(
      makeRequest("dr-1", { name: "New" }, "PATCH"),
      { params: { id: "dr-1" } },
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/datarooms/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes the dataroom", async () => {
    mockSession();
    dataroomFindFirstMock.mockResolvedValue({ id: "dr-1" });
    dataroomDeleteMock.mockResolvedValue({ id: "dr-1" });

    const res = await DELETE(
      makeRequest("dr-1", undefined, "DELETE"),
      { params: { id: "dr-1" } },
    );
    expect(res.status).toBe(200);
    expect(dataroomDeleteMock).toHaveBeenCalledWith({
      where: { id: "dr-1" },
    });
  });

  it("rejects VIEWER", async () => {
    mockSession("VIEWER");
    const res = await DELETE(
      makeRequest("dr-1", undefined, "DELETE"),
      { params: { id: "dr-1" } },
    );
    expect(res.status).toBe(401);
  });
});
