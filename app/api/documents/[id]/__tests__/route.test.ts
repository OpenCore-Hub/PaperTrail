import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { DELETE } from "../route";

const {
  getServerSessionMock,
  documentFindFirstMock,
  documentDeleteMock,
  deleteFilesMock,
  MockUTApi,
} = vi.hoisted(() => {
  const sendMock = vi.fn();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function MockUTApi(this: any) {
    this.deleteFiles = sendMock;
  }
  return {
    getServerSessionMock: vi.fn(),
    documentFindFirstMock: vi.fn(),
    documentDeleteMock: vi.fn(),
    deleteFilesMock: sendMock,
    MockUTApi,
  };
});

vi.mock("uploadthing/server", () => ({
  UTApi: MockUTApi,
}));

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findFirst: documentFindFirstMock,
      delete: documentDeleteMock,
    },
  },
}));

function makeRequest(id = "doc-1"): NextRequest {
  return new NextRequest(`http://localhost:3000/api/documents/${id}`, {
    method: "DELETE",
  }) as NextRequest;
}

function mockSession() {
  getServerSessionMock.mockResolvedValue({
    user: { id: "user-1", workspaceId: "ws-1", role: "ADMIN" },
  });
}

describe("DELETE /api/documents/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated users", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await DELETE(makeRequest(), { params: { id: "doc-1" } });
    expect(res.status).toBe(401);
  });

  it("returns 404 for documents outside the workspace", async () => {
    mockSession();
    documentFindFirstMock.mockResolvedValue(null);
    const res = await DELETE(makeRequest(), { params: { id: "doc-1" } });
    expect(res.status).toBe(404);
  });

  it("deletes the document and cleans up storage", async () => {
    mockSession();
    documentFindFirstMock.mockResolvedValue({
      id: "doc-1",
      storageKey: "file-key-123",
    });
    deleteFilesMock.mockResolvedValue({ success: true });

    const res = await DELETE(makeRequest(), { params: { id: "doc-1" } });
    expect(res.status).toBe(200);
    expect(deleteFilesMock).toHaveBeenCalledWith("file-key-123");
    expect(documentDeleteMock).toHaveBeenCalledWith({ where: { id: "doc-1" } });
  });

  it("deletes the DB row even if storage cleanup fails", async () => {
    mockSession();
    documentFindFirstMock.mockResolvedValue({
      id: "doc-1",
      storageKey: "file-key-123",
    });
    deleteFilesMock.mockRejectedValue(new Error("UploadThing down"));

    const res = await DELETE(makeRequest(), { params: { id: "doc-1" } });
    expect(res.status).toBe(200);
    expect(documentDeleteMock).toHaveBeenCalledWith({ where: { id: "doc-1" } });
  });
});
