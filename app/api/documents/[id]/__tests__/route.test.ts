import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { DELETE } from "../route";

const {
  getServerSessionMock,
  documentFindFirstMock,
  documentDeleteMock,
  getLatestVersionOrThrowMock,
  storageDeleteMock,
} = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  documentFindFirstMock: vi.fn(),
  documentDeleteMock: vi.fn(),
  getLatestVersionOrThrowMock: vi.fn(),
  storageDeleteMock: vi.fn(),
}));

vi.mock("uploadthing/server", () => ({
  UTApi: vi.fn(),
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

vi.mock("@/lib/documents/get-latest-version", () => ({
  getLatestVersionOrThrow: getLatestVersionOrThrowMock,
}));

vi.mock("@/lib/storage/factory", () => ({
  getStorageProvider: vi.fn().mockImplementation(() => ({
    delete: storageDeleteMock,
  })),
}));

function makeRequest(id = "doc-1"): NextRequest {
  return new NextRequest(`http://localhost:3000/api/documents/${id}`, {
    method: "DELETE",
  }) as NextRequest;
}

function mockSession(role: "ADMIN" | "EDITOR" | "VIEWER" = "ADMIN") {
  getServerSessionMock.mockResolvedValue({
    user: { id: "user-1", workspaceId: "ws-1", role },
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

  it("rejects VIEWER role", async () => {
    mockSession("VIEWER");
    const res = await DELETE(makeRequest(), { params: { id: "doc-1" } });
    expect(res.status).toBe(401);
  });

  it("deletes the document and cleans up storage", async () => {
    mockSession();
    documentFindFirstMock.mockResolvedValue({ id: "doc-1" });
    getLatestVersionOrThrowMock.mockResolvedValue({
      storageKey: "file-key-123",
    });
    storageDeleteMock.mockResolvedValue(undefined);

    const res = await DELETE(makeRequest(), { params: { id: "doc-1" } });
    expect(res.status).toBe(200);
    expect(storageDeleteMock).toHaveBeenCalledWith("file-key-123");
    expect(documentDeleteMock).toHaveBeenCalledWith({ where: { id: "doc-1" } });
  });

  it("deletes the DB row even if storage cleanup fails", async () => {
    mockSession();
    documentFindFirstMock.mockResolvedValue({ id: "doc-1" });
    getLatestVersionOrThrowMock.mockResolvedValue({
      storageKey: "file-key-123",
    });
    storageDeleteMock.mockRejectedValue(new Error("Storage down"));

    const res = await DELETE(makeRequest(), { params: { id: "doc-1" } });
    expect(res.status).toBe(200);
    expect(documentDeleteMock).toHaveBeenCalledWith({ where: { id: "doc-1" } });
  });
});
