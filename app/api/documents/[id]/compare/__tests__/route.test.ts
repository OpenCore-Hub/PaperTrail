import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

const {
  getServerSessionMock,
  documentFindFirstMock,
  documentVersionFindManyMock,
  aiProviderConfigFindUniqueMock,
  auditMock,
  createLoggerMock,
  getStreamMock,
  parsePdfMock,
  completeMock,
  createAiProviderMock,
  resolveAiConfigMock,
} = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  documentFindFirstMock: vi.fn(),
  documentVersionFindManyMock: vi.fn(),
  aiProviderConfigFindUniqueMock: vi.fn(),
  auditMock: vi.fn(),
  createLoggerMock: vi.fn(() => ({ info: vi.fn(), error: vi.fn() })),
  getStreamMock: vi.fn(),
  parsePdfMock: vi.fn(),
  completeMock: vi.fn(),
  createAiProviderMock: vi.fn(() => ({
    id: "openai",
    complete: completeMock,
    embed: vi.fn(),
  })),
  resolveAiConfigMock: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: { findFirst: documentFindFirstMock },
    documentVersion: { findMany: documentVersionFindManyMock },
    aiProviderConfig: { findUnique: aiProviderConfigFindUniqueMock },
  },
}));

vi.mock("@/lib/audit", () => ({ audit: auditMock }));

vi.mock("@/lib/logger", () => ({ createLogger: createLoggerMock }));

vi.mock("@/lib/storage/factory", () => ({
  getStorageProvider: vi.fn(() => ({ getStream: getStreamMock })),
}));

vi.mock("@/lib/ai/parsers/pdf-parser", () => ({
  parsePdf: parsePdfMock,
}));

vi.mock("@/lib/ai/providers/factory", () => ({
  resolveAiConfig: resolveAiConfigMock,
  createAiProvider: createAiProviderMock,
}));

function mockSession(role: "ADMIN" | "EDITOR" | "VIEWER" = "ADMIN") {
  getServerSessionMock.mockResolvedValue({
    user: { id: "user-1", workspaceId: "ws-1", role },
  });
}

function makeRequest(documentId = "doc-1", body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/documents/${documentId}/compare`,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    },
  );
}

function makeVersion(id: string, documentId: string, storageKey: string) {
  return {
    id,
    documentId,
    versionNumber: 1,
    storageKey,
    storageType: "UPLOADTHING" as const,
    fileSize: 1234,
    pageCount: 2,
    contentType: "application/pdf",
    aiStatus: "READY" as const,
    createdBy: "user-1",
    createdAt: new Date(),
  };
}

function makeParsedPages(count: number, textLengthEach = 20) {
  const pages = Array.from({ length: count }, (_, i) => ({
    pageNumber: i + 1,
    text: "x".repeat(textLengthEach),
  }));
  return { pages, pageCount: count };
}

beforeEach(() => {
  vi.clearAllMocks();
  getStreamMock.mockResolvedValue(Buffer.from("pdf"));
});

describe("POST /api/documents/[id]/compare", () => {
  it("rejects unauthenticated users", async () => {
    getServerSessionMock.mockResolvedValue(null);

    const res = await POST(
      makeRequest("doc-1", {
        baseVersionId: "11111111-1111-1111-1111-111111111111",
        targetVersionId: "22222222-2222-2222-2222-222222222222",
      }),
      { params: { id: "doc-1" } },
    );
    expect(res.status).toBe(401);
  });

  const baseVersionId = "11111111-1111-4111-a111-111111111111";
  const targetVersionId = "22222222-2222-4222-b222-222222222222";

  it("returns 404 when document does not belong to workspace", async () => {
    mockSession();
    documentFindFirstMock.mockResolvedValue(null);

    const res = await POST(
      makeRequest("doc-1", { baseVersionId, targetVersionId }),
      { params: { id: "doc-1" } },
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when a version does not belong to the document", async () => {
    mockSession();
    documentFindFirstMock.mockResolvedValue({
      id: "doc-1",
      workspaceId: "ws-1",
    });
    documentVersionFindManyMock.mockResolvedValue([
      makeVersion("00000000-0000-0000-0000-000000000001", "doc-1", "key-1"),
    ]);

    const res = await POST(
      makeRequest("doc-1", { baseVersionId, targetVersionId }),
      { params: { id: "doc-1" } },
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when documents are too large", async () => {
    mockSession();
    documentFindFirstMock.mockResolvedValue({
      id: "doc-1",
      workspaceId: "ws-1",
    });
    documentVersionFindManyMock.mockResolvedValue([
      makeVersion(baseVersionId, "doc-1", "key-1"),
      makeVersion(targetVersionId, "doc-1", "key-2"),
    ]);
    parsePdfMock.mockResolvedValue(makeParsedPages(101));

    const res = await POST(
      makeRequest("doc-1", { baseVersionId, targetVersionId }),
      { params: { id: "doc-1" } },
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("too large for AI comparison");
  });

  it("returns structured AI comparison result", async () => {
    mockSession();
    documentFindFirstMock.mockResolvedValue({
      id: "doc-1",
      workspaceId: "ws-1",
    });
    documentVersionFindManyMock.mockResolvedValue([
      makeVersion(baseVersionId, "doc-1", "key-1"),
      makeVersion(targetVersionId, "doc-1", "key-2"),
    ]);
    parsePdfMock
      .mockResolvedValueOnce(makeParsedPages(2, 100))
      .mockResolvedValueOnce(makeParsedPages(2, 120));

    completeMock.mockResolvedValue({
      content: JSON.stringify({
        sections: [
          {
            title: "Scope",
            status: "modified",
            baseText: "Build app",
            targetText: "Build platform",
            riskLevel: "medium",
            notes: "Scope expanded",
          },
        ],
        numericChanges: [{ label: "Budget", baseValue: 100, targetValue: 120 }],
        summary: "Scope and budget increased.",
      }),
      usage: { promptTokens: 500, completionTokens: 200 },
    });

    const res = await POST(
      makeRequest("doc-1", { baseVersionId, targetVersionId }),
      { params: { id: "doc-1" } },
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.sections).toHaveLength(1);
    expect(json.sections[0].title).toBe("Scope");
    expect(json.numericChanges[0].targetValue).toBe(120);
    expect(json.summary).toBe("Scope and budget increased.");

    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "document.compared",
        actor: { userId: "user-1", workspaceId: "ws-1" },
        resource: { type: "document", id: "doc-1" },
      }),
    );
  });
});
