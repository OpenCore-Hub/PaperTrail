import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

const {
  getServerSessionMock,
  dataroomFindFirstMock,
  documentFindFirstMock,
  dataroomFolderFindFirstMock,
  dataroomDocumentFindManyMock,
  dataroomDocumentCreateMock,
} = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  dataroomFindFirstMock: vi.fn(),
  documentFindFirstMock: vi.fn(),
  dataroomFolderFindFirstMock: vi.fn(),
  dataroomDocumentFindManyMock: vi.fn(),
  dataroomDocumentCreateMock: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dataroom: { findFirst: dataroomFindFirstMock },
    document: { findFirst: documentFindFirstMock },
    dataroomFolder: { findFirst: dataroomFolderFindFirstMock },
    dataroomDocument: {
      findMany: dataroomDocumentFindManyMock,
      create: dataroomDocumentCreateMock,
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
    `http://localhost:3000/api/datarooms/${id}/documents`,
    {
      method,
      ...(body !== undefined && { body: JSON.stringify(body) }),
    },
  ) as NextRequest;
}

describe("GET /api/datarooms/[id]/documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated users", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await GET(makeRequest(), { params: { id: "dr-1" } });
    expect(res.status).toBe(401);
  });

  it("lists mounted documents", async () => {
    mockSession();
    dataroomFindFirstMock.mockResolvedValue({ id: "dr-1" });
    dataroomDocumentFindManyMock.mockResolvedValue([
      { id: "dd-1", document: { id: "doc-1", filename: "a.pdf" } },
    ]);

    const res = await GET(makeRequest(), { params: { id: "dr-1" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.documents).toHaveLength(1);
  });

  it("returns 404 when dataroom outside workspace", async () => {
    mockSession();
    dataroomFindFirstMock.mockResolvedValue(null);
    const res = await GET(makeRequest(), { params: { id: "dr-1" } });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/datarooms/[id]/documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mounts a document", async () => {
    mockSession();
    dataroomFindFirstMock.mockResolvedValue({ id: "dr-1" });
    documentFindFirstMock.mockResolvedValue({
      id: "doc-1",
      workspaceId: "ws-1",
    });
    dataroomDocumentCreateMock.mockResolvedValue({
      id: "dd-1",
      document: { id: "doc-1", filename: "a.pdf" },
    });

    const res = await POST(
      makeRequest(
        "dr-1",
        { documentId: "a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6" },
        "POST",
      ),
      { params: { id: "dr-1" } },
    );
    expect(res.status).toBe(201);
  });

  it("rejects document outside workspace", async () => {
    mockSession();
    dataroomFindFirstMock.mockResolvedValue({ id: "dr-1" });
    documentFindFirstMock.mockResolvedValue(null);

    const res = await POST(
      makeRequest(
        "dr-1",
        { documentId: "a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6" },
        "POST",
      ),
      { params: { id: "dr-1" } },
    );
    expect(res.status).toBe(404);
  });

  it("rejects folder outside the dataroom", async () => {
    mockSession();
    dataroomFindFirstMock.mockResolvedValue({ id: "dr-1" });
    documentFindFirstMock.mockResolvedValue({
      id: "doc-1",
      workspaceId: "ws-1",
    });
    dataroomFolderFindFirstMock.mockResolvedValue(null);

    const res = await POST(
      makeRequest(
        "dr-1",
        {
          documentId: "a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6",
          folderId: "b2c3d4e5-f6a7-8b9c-0d1e-f2a3b4c5d6e7",
        },
        "POST",
      ),
      { params: { id: "dr-1" } },
    );
    expect(res.status).toBe(400);
  });

  it("rejects VIEWER role", async () => {
    mockSession("VIEWER");
    const res = await POST(
      makeRequest("dr-1", { documentId: "doc-1" }, "POST"),
      { params: { id: "dr-1" } },
    );
    expect(res.status).toBe(401);
  });
});
