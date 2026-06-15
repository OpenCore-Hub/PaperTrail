import { describe, it, expect, vi, beforeEach } from "vitest";
import { askDocumentQuestion } from "../query";

const {
  completeMock,
  embedMock,
  auditMock,
  createLoggerMock,
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
  documentId: "doc-1",
  workspaceId: "ws-1",
  userId: "user-1",
  question: "What is this document about?",
};

function makeReadyVersion(id = "version-1") {
  return {
    id,
    documentId: baseOptions.documentId,
    versionNumber: 1,
    aiStatus: "READY" as const,
    storageKey: "key-1",
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
      score: 0.95,
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      content: "The timeline is aggressive but achievable.",
      page_number: 2,
      score: 0.88,
    },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  embedMock.mockResolvedValue([0.1, 0.2, 0.3]);
  completeMock.mockResolvedValue({
    content:
      "It explains project goals [citation:11111111-1111-1111-1111-111111111111] and mentions the timeline [citation:22222222-2222-2222-2222-222222222222].",
    usage: { promptTokens: 100, completionTokens: 25 },
  });
  aiMessageFindManyMock.mockResolvedValue([]);
  aiMessageCreateMock.mockResolvedValue({ id: "msg-new" });
  transactionMock.mockImplementation((ops: Array<Promise<unknown>>) =>
    Promise.all(ops),
  );
  queryRawMock.mockResolvedValue(makeChunks());
});

describe("askDocumentQuestion", () => {
  it("throws when the document has no AI-ready version", async () => {
    documentVersionFindFirstMock.mockResolvedValue(null);

    await expect(askDocumentQuestion(baseOptions)).rejects.toThrow(
      /no AI-ready version/,
    );
  });

  it("throws when the document has no indexed chunks", async () => {
    documentVersionFindFirstMock.mockResolvedValue(makeReadyVersion());
    aiProviderConfigFindUniqueMock.mockResolvedValue(null);
    queryRawMock.mockResolvedValue([]);

    await expect(askDocumentQuestion(baseOptions)).rejects.toThrow(
      /no indexed chunks/,
    );
  });

  it("creates a new conversation, persists messages, and returns citations", async () => {
    documentVersionFindFirstMock.mockResolvedValue(makeReadyVersion());
    aiProviderConfigFindUniqueMock.mockResolvedValue(null);
    aiConversationCreateMock.mockResolvedValue({
      id: "conv-1",
      scopeType: "DOCUMENT",
      scopeId: baseOptions.documentId,
      title: baseOptions.question,
    });

    const result = await askDocumentQuestion(baseOptions);

    expect(documentVersionFindFirstMock).toHaveBeenCalledWith({
      where: {
        documentId: baseOptions.documentId,
        aiStatus: "READY",
      },
      orderBy: { versionNumber: "desc" },
    });

    expect(createAiProviderMock).toHaveBeenCalled();
    expect(embedMock).toHaveBeenCalledWith({ text: baseOptions.question });
    expect(completeMock).toHaveBeenCalled();

    expect(aiConversationCreateMock).toHaveBeenCalledWith({
      data: {
        scopeType: "DOCUMENT",
        scopeId: baseOptions.documentId,
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
    expect(result.citations[0].chunkId).toBe(
      "11111111-1111-1111-1111-111111111111",
    );
    expect(result.citations[1].chunkId).toBe(
      "22222222-2222-2222-2222-222222222222",
    );
    expect(result.usage).toEqual({
      promptTokens: 100,
      completionTokens: 25,
    });

    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ai.query",
        actor: {
          userId: baseOptions.userId,
          workspaceId: baseOptions.workspaceId,
        },
        resource: { type: "document", id: baseOptions.documentId },
      }),
    );
  });

  it("reuses an existing conversation when conversationId is provided", async () => {
    documentVersionFindFirstMock.mockResolvedValue(makeReadyVersion());
    aiProviderConfigFindUniqueMock.mockResolvedValue(null);
    aiConversationFindFirstMock.mockResolvedValue({
      id: "conv-existing",
      scopeType: "DOCUMENT",
      scopeId: baseOptions.documentId,
      title: "Old title",
    });
    aiConversationUpdateMock.mockResolvedValue({
      id: "conv-existing",
      scopeType: "DOCUMENT",
      scopeId: baseOptions.documentId,
      title: baseOptions.question,
    });

    const result = await askDocumentQuestion({
      ...baseOptions,
      conversationId: "conv-existing",
    });

    expect(aiConversationFindFirstMock).toHaveBeenCalledWith({
      where: {
        id: "conv-existing",
        scopeType: "DOCUMENT",
        scopeId: baseOptions.documentId,
      },
    });
    expect(aiConversationCreateMock).not.toHaveBeenCalled();
    expect(aiConversationUpdateMock).toHaveBeenCalledWith({
      where: { id: "conv-existing" },
      data: { updatedAt: expect.any(Date), title: baseOptions.question },
    });

    expect(aiMessageFindManyMock).toHaveBeenCalledWith({
      where: { conversationId: "conv-existing" },
      orderBy: { createdAt: "asc" },
    });
    expect(result.conversationId).toBe("conv-existing");
  });

  it("returns empty citations when the answer has no citation markers", async () => {
    documentVersionFindFirstMock.mockResolvedValue(makeReadyVersion());
    aiProviderConfigFindUniqueMock.mockResolvedValue(null);
    completeMock.mockResolvedValue({
      content: "A plain answer with no citations.",
      usage: { promptTokens: 50, completionTokens: 10 },
    });
    aiConversationCreateMock.mockResolvedValue({
      id: "conv-2",
      scopeType: "DOCUMENT",
      scopeId: baseOptions.documentId,
      title: baseOptions.question,
    });

    const result = await askDocumentQuestion(baseOptions);

    expect(result.answer).toBe("A plain answer with no citations.");
    expect(result.citations).toEqual([]);
  });

  it("throws when the provided conversationId does not belong to the document", async () => {
    documentVersionFindFirstMock.mockResolvedValue(makeReadyVersion());
    aiProviderConfigFindUniqueMock.mockResolvedValue(null);
    aiConversationFindFirstMock.mockResolvedValue(null);

    await expect(
      askDocumentQuestion({
        ...baseOptions,
        conversationId: "conv-missing",
      }),
    ).rejects.toThrow(/Conversation conv-missing not found/);
  });
});
