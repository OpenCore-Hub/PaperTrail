import { describe, it, expect, vi, beforeEach } from "vitest";
import { askDataroomQuestion } from "../dataroom-chat";

const {
  completeMock,
  embedMock,
  auditMock,
  createLoggerMock,
  dataroomDocumentFindManyMock,
  documentVersionFindFirstMock,
  aiProviderConfigFindUniqueMock,
  aiMessageFindManyMock,
  aiConversationFindFirstMock,
  aiConversationCreateMock,
  aiConversationUpdateMock,
  aiMessageCreateMock,
  transactionMock,
  queryRawMock,
  createAiProviderMock,
  resolveAiConfigMock,
} = vi.hoisted(() => ({
  completeMock: vi.fn(),
  embedMock: vi.fn(),
  auditMock: vi.fn(),
  createLoggerMock: vi.fn(() => ({ info: vi.fn(), error: vi.fn() })),
  dataroomDocumentFindManyMock: vi.fn(),
  documentVersionFindFirstMock: vi.fn(),
  aiProviderConfigFindUniqueMock: vi.fn(),
  aiMessageFindManyMock: vi.fn(),
  aiConversationFindFirstMock: vi.fn(),
  aiConversationCreateMock: vi.fn(),
  aiConversationUpdateMock: vi.fn(),
  aiMessageCreateMock: vi.fn(),
  transactionMock: vi.fn(),
  queryRawMock: vi.fn(),
  createAiProviderMock: vi.fn(() => ({
    id: "openai",
    complete: completeMock,
    embed: embedMock,
  })),
  resolveAiConfigMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dataroomDocument: { findMany: dataroomDocumentFindManyMock },
    documentVersion: { findFirst: documentVersionFindFirstMock },
    aiProviderConfig: { findUnique: aiProviderConfigFindUniqueMock },
    aiMessage: {
      findMany: aiMessageFindManyMock,
      create: aiMessageCreateMock,
    },
    aiConversation: {
      findFirst: aiConversationFindFirstMock,
      create: aiConversationCreateMock,
      update: aiConversationUpdateMock,
    },
    $queryRaw: queryRawMock,
    $transaction: transactionMock,
  },
}));

vi.mock("@/lib/audit", () => ({ audit: auditMock }));

vi.mock("@/lib/logger", () => ({ createLogger: createLoggerMock }));

vi.mock("../providers/factory", () => ({
  resolveAiConfig: resolveAiConfigMock,
  createAiProvider: createAiProviderMock,
}));

const baseOptions = {
  dataroomId: "dr-1",
  workspaceId: "ws-1",
  userId: "user-1",
  question: "What do these documents say?",
};

function makeDataroomDocuments(docs: { id: string; filename: string }[]) {
  return docs.map((d, i) => ({
    id: `dd-${i}`,
    dataroomId: baseOptions.dataroomId,
    folderId: null,
    documentId: d.id,
    order: i,
    addedAt: new Date(),
    document: { id: d.id, filename: d.filename },
  }));
}

function makeReadyVersion(documentId: string, id = `version-${documentId}`) {
  return {
    id,
    documentId,
    versionNumber: 1,
    aiStatus: "READY" as const,
    storageKey: `key-${documentId}`,
    storageType: "UPLOADTHING" as const,
    fileSize: 1234,
    pageCount: 2,
    contentType: "application/pdf",
    createdBy: "user-1",
    createdAt: new Date(),
  };
}

function makeChunks() {
  return [
    {
      id: "11111111-1111-1111-1111-111111111111",
      content: "This document explains project goals.",
      page_number: 1,
      document_version_id: "version-doc-1",
      score: 0.95,
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      content: "The timeline is aggressive but achievable.",
      page_number: 2,
      document_version_id: "version-doc-2",
      score: 0.88,
    },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  embedMock.mockResolvedValue([0.1, 0.2, 0.3]);
  completeMock.mockResolvedValue({
    content:
      "Doc one covers goals [citation:11111111-1111-1111-1111-111111111111] and doc two mentions the timeline [citation:22222222-2222-2222-2222-222222222222].",
    usage: { promptTokens: 120, completionTokens: 30 },
  });
  aiMessageFindManyMock.mockResolvedValue([]);
  aiMessageCreateMock.mockResolvedValue({ id: "msg-new" });
  transactionMock.mockImplementation((ops: Array<Promise<unknown>>) =>
    Promise.all(ops),
  );
});

describe("askDataroomQuestion", () => {
  it("throws when a document has no AI-ready version", async () => {
    dataroomDocumentFindManyMock.mockResolvedValue(
      makeDataroomDocuments([{ id: "doc-1", filename: "A.pdf" }]),
    );
    documentVersionFindFirstMock.mockResolvedValue(null);

    await expect(askDataroomQuestion(baseOptions)).rejects.toThrow(
      /documents without AI-ready versions/,
    );
  });

  it("filters by documentIds", async () => {
    dataroomDocumentFindManyMock.mockResolvedValue(
      makeDataroomDocuments([{ id: "doc-2", filename: "B.pdf" }]),
    );
    documentVersionFindFirstMock.mockResolvedValue(
      makeReadyVersion("doc-2", "version-doc-2"),
    );
    aiProviderConfigFindUniqueMock.mockResolvedValue(null);
    queryRawMock.mockResolvedValue([
      {
        id: "22222222-2222-2222-2222-222222222222",
        content: "Timeline detail.",
        page_number: 2,
        document_version_id: "version-doc-2",
        score: 0.88,
      },
    ]);
    aiConversationCreateMock.mockResolvedValue({
      id: "conv-1",
      scopeType: "DATAROOM",
      scopeId: baseOptions.dataroomId,
      title: baseOptions.question,
    });

    const result = await askDataroomQuestion({
      ...baseOptions,
      documentIds: ["doc-2"],
    });

    expect(dataroomDocumentFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dataroomId: baseOptions.dataroomId,
          documentId: { in: ["doc-2"] },
        }),
      }),
    );

    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]).toMatchObject({
      chunkId: "22222222-2222-2222-2222-222222222222",
      documentId: "doc-2",
      documentName: "B.pdf",
    });
  });

  it("creates conversation, persists messages, and returns document-aware citations", async () => {
    dataroomDocumentFindManyMock.mockResolvedValue(
      makeDataroomDocuments([
        { id: "doc-1", filename: "A.pdf" },
        { id: "doc-2", filename: "B.pdf" },
      ]),
    );
    documentVersionFindFirstMock
      .mockResolvedValueOnce(makeReadyVersion("doc-1", "version-doc-1"))
      .mockResolvedValueOnce(makeReadyVersion("doc-2", "version-doc-2"));
    aiProviderConfigFindUniqueMock.mockResolvedValue(null);
    queryRawMock.mockResolvedValue(makeChunks());
    aiConversationCreateMock.mockResolvedValue({
      id: "conv-1",
      scopeType: "DATAROOM",
      scopeId: baseOptions.dataroomId,
      title: baseOptions.question,
    });

    const result = await askDataroomQuestion(baseOptions);

    expect(dataroomDocumentFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { dataroomId: baseOptions.dataroomId },
      }),
    );
    expect(documentVersionFindFirstMock).toHaveBeenCalledTimes(2);
    expect(createAiProviderMock).toHaveBeenCalled();
    expect(embedMock).toHaveBeenCalledWith({ text: baseOptions.question });
    expect(queryRawMock).toHaveBeenCalled();
    expect(completeMock).toHaveBeenCalled();

    expect(aiConversationCreateMock).toHaveBeenCalledWith({
      data: {
        scopeType: "DATAROOM",
        scopeId: baseOptions.dataroomId,
        title: baseOptions.question,
      },
    });

    expect(aiMessageCreateMock).toHaveBeenCalledTimes(2);
    expect(aiMessageCreateMock).toHaveBeenNthCalledWith(1, {
      data: {
        conversationId: "conv-1",
        role: "USER",
        content: baseOptions.question,
      },
    });
    expect(aiMessageCreateMock).toHaveBeenNthCalledWith(2, {
      data: {
        conversationId: "conv-1",
        role: "ASSISTANT",
        content: result.answer,
        citations: expect.any(Array),
      },
    });

    expect(result.conversationId).toBe("conv-1");
    expect(result.citations).toHaveLength(2);
    expect(result.citations[0]).toMatchObject({
      chunkId: "11111111-1111-1111-1111-111111111111",
      pageNumber: 1,
      documentId: "doc-1",
      documentName: "A.pdf",
    });
    expect(result.citations[1]).toMatchObject({
      chunkId: "22222222-2222-2222-2222-222222222222",
      pageNumber: 2,
      documentId: "doc-2",
      documentName: "B.pdf",
    });

    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ai.dataroom_query",
        actor: {
          userId: baseOptions.userId,
          workspaceId: baseOptions.workspaceId,
        },
        resource: { type: "dataroom", id: baseOptions.dataroomId },
      }),
    );
  });

  it("reuses an existing conversation", async () => {
    dataroomDocumentFindManyMock.mockResolvedValue(
      makeDataroomDocuments([{ id: "doc-1", filename: "A.pdf" }]),
    );
    documentVersionFindFirstMock.mockResolvedValue(
      makeReadyVersion("doc-1", "version-doc-1"),
    );
    aiProviderConfigFindUniqueMock.mockResolvedValue(null);
    queryRawMock.mockResolvedValue([
      {
        id: "11111111-1111-1111-1111-111111111111",
        content: "Goals.",
        page_number: 1,
        document_version_id: "version-doc-1",
        score: 0.95,
      },
    ]);
    aiConversationFindFirstMock.mockResolvedValue({
      id: "conv-existing",
      scopeType: "DATAROOM",
      scopeId: baseOptions.dataroomId,
      title: "Old",
    });
    aiConversationUpdateMock.mockResolvedValue({
      id: "conv-existing",
      scopeType: "DATAROOM",
      scopeId: baseOptions.dataroomId,
      title: baseOptions.question,
    });

    const result = await askDataroomQuestion({
      ...baseOptions,
      conversationId: "conv-existing",
    });

    expect(aiConversationFindFirstMock).toHaveBeenCalledWith({
      where: {
        id: "conv-existing",
        scopeType: "DATAROOM",
        scopeId: baseOptions.dataroomId,
      },
    });
    expect(aiConversationCreateMock).not.toHaveBeenCalled();
    expect(aiConversationUpdateMock).toHaveBeenCalledWith({
      where: { id: "conv-existing" },
      data: { updatedAt: expect.any(Date), title: baseOptions.question },
    });
    expect(result.conversationId).toBe("conv-existing");
  });
});
