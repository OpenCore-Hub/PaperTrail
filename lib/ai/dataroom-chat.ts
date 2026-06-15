import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { audit } from "@/lib/audit";
import { resolveAiConfig, createAiProvider } from "./providers/factory";
import type { IAiProvider } from "./providers/types";
import { extractCitations, type Citation } from "./citations";
import { Prisma, type AiMessageRole, type AiScopeType } from "@prisma/client";

const log = createLogger("ai.dataroom_query");

const SYSTEM_PROMPT_BASE =
  "You are a helpful dataroom assistant. Answer using only the provided document context. Cite sources using [citation:<chunkId>].";

const MAX_TITLE_LENGTH = 120;

export interface DataroomCitation extends Citation {
  documentId: string;
  documentName: string;
}

export interface AskDataroomOptions {
  dataroomId: string;
  workspaceId: string;
  userId: string;
  question: string;
  conversationId?: string;
  documentIds?: string[];
}

export interface AskDataroomResult {
  answer: string;
  citations: DataroomCitation[];
  conversationId: string;
  usage: { promptTokens: number; completionTokens: number };
}

interface ChunkResult {
  id: string;
  content: string;
  page_number: number;
  document_version_id: string;
  score: number;
}

function createDefaultProvider(): IAiProvider {
  return createAiProvider(
    {
      mode: "CLOUD",
      provider: "openai",
      model: "gpt-4o-mini",
      apiKey: process.env.OPENAI_API_KEY,
    },
    {
      embeddingModel: "text-embedding-3-small",
    },
  );
}

function truncateTitle(question: string): string {
  if (question.length <= MAX_TITLE_LENGTH) return question;
  return `${question.slice(0, MAX_TITLE_LENGTH - 1)}…`;
}

/**
 * Ask a question across all AI-ready documents in a dataroom.
 *
 * Steps:
 * 1. Resolve dataroom documents (optionally filtered to a subset).
 * 2. Resolve the latest READY DocumentVersion for each document.
 * 3. Load/resolve the workspace AI provider (fallback to OpenAI env defaults).
 * 4. Embed the question.
 * 5. Retrieve top-8 semantically similar chunks across all ready versions via
 *    pgvector cosine distance.
 * 6. Build context (grouped by document) and send to provider with prior
 *    messages.
 * 7. Extract citations from the answer, annotating each with the document it
 *    came from.
 * 8. Persist conversation + messages.
 * 9. Audit and return the result.
 */
export async function askDataroomQuestion(
  options: AskDataroomOptions,
): Promise<AskDataroomResult> {
  const { dataroomId, workspaceId, userId, question, conversationId, documentIds } =
    options;

  log.info(
    { dataroomId, workspaceId, userId, conversationId, documentIds },
    "dataroom_query_started",
  );

  try {
    const dataroomDocuments = await prisma.dataroomDocument.findMany({
      where: {
        dataroomId,
        ...(documentIds && documentIds.length > 0
          ? { documentId: { in: documentIds } }
          : {}),
      },
      include: {
        document: {
          select: { id: true, filename: true },
        },
      },
    });

    if (dataroomDocuments.length === 0) {
      throw new Error(
        `Dataroom ${dataroomId} contains no documents matching the requested filters.`,
      );
    }

    const versionMap = new Map<
      string,
      { versionId: string; documentId: string; documentName: string }
    >();
    const missingReadyVersionDocumentIds: string[] = [];

    for (const dataroomDoc of dataroomDocuments) {
      const latestVersion = await prisma.documentVersion.findFirst({
        where: {
          documentId: dataroomDoc.documentId,
          aiStatus: "READY",
        },
        orderBy: { versionNumber: "desc" },
      });

      if (!latestVersion) {
        missingReadyVersionDocumentIds.push(dataroomDoc.documentId);
        continue;
      }

      versionMap.set(latestVersion.id, {
        versionId: latestVersion.id,
        documentId: dataroomDoc.document.id,
        documentName: dataroomDoc.document.filename,
      });
    }

    if (missingReadyVersionDocumentIds.length > 0) {
      throw new Error(
        `Dataroom ${dataroomId} has documents without AI-ready versions: ${missingReadyVersionDocumentIds.join(", ")}. Indexing may be pending or failed.`,
      );
    }

    const versionIds = Array.from(versionMap.keys());
    if (versionIds.length === 0) {
      throw new Error(
        `Dataroom ${dataroomId} has no AI-ready documents. Indexing may be pending or failed.`,
      );
    }

    const aiProviderConfig = await prisma.aiProviderConfig.findUnique({
      where: { workspaceId },
    });

    const provider = aiProviderConfig
      ? createAiProvider(resolveAiConfig(aiProviderConfig), {
          openaiApiKey: process.env.OPENAI_API_KEY,
          anthropicApiKey: process.env.ANTHROPIC_API_KEY,
          embeddingModel: "text-embedding-3-small",
        })
      : createDefaultProvider();

    const embedding = await provider.embed({ text: question });

    const chunks = await prisma.$queryRaw<ChunkResult[]>`
      SELECT
        id,
        content,
        page_number,
        document_version_id,
        1 - (embedding <=> ${embedding}::vector) AS score
      FROM document_chunks
      WHERE document_version_id IN (${Prisma.join(versionIds)})
      ORDER BY embedding <=> ${embedding}::vector
      LIMIT 8
    `;

    if (!chunks || chunks.length === 0) {
      throw new Error(
        `Dataroom ${dataroomId} has no indexed chunks available for AI query across ready document versions.`,
      );
    }

    const contextParts = chunks.map((chunk) => {
      const doc = versionMap.get(chunk.document_version_id);
      const documentName = doc?.documentName ?? "Unknown document";
      return `[Document: ${documentName}] [Page: ${chunk.page_number}] [Chunk: ${chunk.id}]\n${chunk.content}`;
    });
    const context = contextParts.join("\n\n---\n\n");

    const systemMessage = `${SYSTEM_PROMPT_BASE}\n\nDataroom document context:\n${context}`;

    const priorMessages = conversationId
      ? await prisma.aiMessage.findMany({
          where: { conversationId },
          orderBy: { createdAt: "asc" },
        })
      : [];

    const messages = [
      { role: "system" as const, content: systemMessage },
      ...priorMessages.map((m) => ({
        role:
          m.role === "ASSISTANT"
            ? ("assistant" as const)
            : m.role === "SYSTEM"
              ? ("system" as const)
              : ("user" as const),
        content: m.content,
      })),
      { role: "user" as const, content: question },
    ];

    const completion = await provider.complete({
      messages,
      temperature: 0.3,
      maxTokens: 2048,
    });

    const availableChunks = chunks.map((chunk) => {
      const doc = versionMap.get(chunk.document_version_id);
      return {
        id: chunk.id,
        pageNumber: chunk.page_number,
        excerpt: chunk.content.slice(0, 200),
        documentId: doc?.documentId ?? chunk.document_version_id,
        documentName: doc?.documentName ?? "Unknown document",
      };
    });

    const citations = extractCitations(
      completion.content,
      availableChunks,
    ) as DataroomCitation[];

    const conversation = await upsertConversation(
      conversationId,
      dataroomId,
      question,
    );

    await prisma.$transaction([
      prisma.aiMessage.create({
        data: {
          conversationId: conversation.id,
          role: "USER" satisfies AiMessageRole,
          content: question,
        },
      }),
      prisma.aiMessage.create({
        data: {
          conversationId: conversation.id,
          role: "ASSISTANT" satisfies AiMessageRole,
          content: completion.content,
          citations: citations as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);

    const usage = {
      promptTokens: completion.usage.promptTokens,
      completionTokens: completion.usage.completionTokens,
    };

    await audit({
      action: "ai.dataroom_query",
      actor: { userId, workspaceId },
      resource: { type: "dataroom", id: dataroomId },
      metadata: {
        conversationId: conversation.id,
        citations,
        tokens: usage,
        documentIds,
      },
    });

    log.info(
      {
        dataroomId,
        workspaceId,
        conversationId: conversation.id,
        citations: citations.length,
        tokens: usage,
      },
      "dataroom_query_completed",
    );

    return {
      answer: completion.content,
      citations,
      conversationId: conversation.id,
      usage,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.error(
      { dataroomId, workspaceId, userId, error: err.message },
      "dataroom_query_failed",
    );
    throw err;
  }
}

async function upsertConversation(
  conversationId: string | undefined,
  dataroomId: string,
  question: string,
) {
  const scopeType: AiScopeType = "DATAROOM";
  const title = truncateTitle(question);

  if (conversationId) {
    const existing = await prisma.aiConversation.findFirst({
      where: {
        id: conversationId,
        scopeType,
        scopeId: dataroomId,
      },
    });

    if (!existing) {
      throw new Error(
        `Conversation ${conversationId} not found for dataroom ${dataroomId}.`,
      );
    }

    return prisma.aiConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date(), title },
    });
  }

  return prisma.aiConversation.create({
    data: {
      scopeType,
      scopeId: dataroomId,
      title,
    },
  });
}
