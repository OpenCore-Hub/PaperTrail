import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

const {
  getServerSessionMock,
  dataroomFindManyMock,
  dataroomCreateMock,
} = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  dataroomFindManyMock: vi.fn(),
  dataroomCreateMock: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dataroom: {
      findMany: dataroomFindManyMock,
      create: dataroomCreateMock,
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

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/datarooms", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("GET /api/datarooms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated users", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("lists datarooms scoped to the workspace", async () => {
    mockSession();
    dataroomFindManyMock.mockResolvedValue([
      {
        id: "dr-1",
        name: "Investor Data Room",
        _count: { documents: 2, folders: 1 },
      },
    ]);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.datarooms).toHaveLength(1);
    expect(dataroomFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: "ws-1" },
      }),
    );
  });
});

describe("POST /api/datarooms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a dataroom for ADMIN", async () => {
    mockSession();
    dataroomCreateMock.mockResolvedValue({
      id: "dr-1",
      name: "Investor Data Room",
      _count: { documents: 0, folders: 0 },
    });

    const res = await POST(
      makePostRequest({ name: "Investor Data Room", description: "Q2" }),
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.dataroom.name).toBe("Investor Data Room");
    expect(dataroomCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          workspaceId: "ws-1",
          name: "Investor Data Room",
          description: "Q2",
        },
      }),
    );
  });

  it("creates a dataroom for EDITOR", async () => {
    mockSession("EDITOR");
    dataroomCreateMock.mockResolvedValue({
      id: "dr-1",
      name: "Editor Room",
      _count: { documents: 0, folders: 0 },
    });

    const res = await POST(makePostRequest({ name: "Editor Room" }));
    expect(res.status).toBe(201);
  });

  it("rejects VIEWER role", async () => {
    mockSession("VIEWER");
    const res = await POST(makePostRequest({ name: "Investor Data Room" }));
    expect(res.status).toBe(401);
  });

  it("rejects invalid input", async () => {
    mockSession();
    const res = await POST(makePostRequest({}));
    expect(res.status).toBe(400);
  });
});
