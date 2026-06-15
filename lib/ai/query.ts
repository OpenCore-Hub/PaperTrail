import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { audit } from "@/lib/audit";
import { resolveAiConfig, createAiProvider } from "./providers/factory";
import type { IAiProvider } from "./providers/types";
import { extractCitations, type Citation } from "./citations";
import { Prisma, type AiMessageRole, type AiScopeType } from "@prisma/client";

const log = createLogger("ai.document_query");

const SYSTEM_PROMPT_BASE =
  "You are a helpful document assistant. Answer using only the provided document context. Cite sources using [citation:<chunkId>].";

const MAX_TITLE_LENGTH = 120;

export interface AskDocumentOptions {
  documentId: string;
  workspaceId: string;
  userId: string;
  question: string;
  conversationId?: string;
}

export interface AskDocumentResult {
  answer: string;
  citations: Citation[];
  conversationId: string;
  usage: { promptTokens: number; completionTokens: number };
}

interface ChunkResult {
  id: string;
  content: string;
  page_number: number;
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
 * Ask a question against a document's indexed chunks.
 *
 * Steps:
 * 1. Resolve the latest READY DocumentVersion.
 * 2. Load/resolve the workspace AI provider (fallback to OpenAI env defaults).
 * 3. Embed the question.
 * 4. Retrieve top-6 semantically similar chunks via pgvector cosine distance.
 * 5. Build context from chunks and send to the provider with prior messages.
 * 6. Extract citations from the answer.
 * 7. Persist conversation + messages.
 * 8. Audit and return the result.
 */
export async function askDocumentQuestion(
  options: AskDocumentOptions,
): Promise<AskDocumentResult> {
  const { documentId, workspaceId, userId, question, conversationId } = options;

  log.info(
    { documentId, workspaceId, userId, conversationId },
    "document_query_started",
  );

  try {
    const latestVersion = await prisma.documentVersion.findFirst({
      where: {
        documentId,
        aiStatus: "READY",
      },
      orderBy: { versionNumber: "desc" },
    });

    if (!latestVersion) {
      throw new Error(
        `Document ${documentId} has no AI-ready version. Indexing may be pending or failed.`,
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
    const versionId = latestVersion.id;

    const chunks = await prisma.$queryRaw<ChunkResult[]>`
      SELECT
        id,
        content,
        page_number,
        1 - (embedding <=> ${embedding}::vector) AS score
      FROM document_chunks
      WHERE document_version_id = ${versionId}
      ORDER BY embedding <=> ${embedding}::vector
      LIMIT 6
    `;

    if (!chunks || chunks.length === 0) {
      throw new Error(
        `Document ${documentId} has no indexed chunks for AI query.`,
      );
    }

    const contextParts = chunks.map(
      (chunk) => `[chunk:${chunk.id}]\n${chunk.content}`,
    );
    const context = contextParts.join("\n\n---\n\n");

    const systemMessage = `${SYSTEM_PROMPT_BASE}\n\nDocument context:\n${context}`;

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

    const availableChunks = chunks.map((chunk) => ({
      id: chunk.id,
      pageNumber: chunk.page_number,
      excerpt: chunk.content.slice(0, 200),
    }));

    const citations = extractCitations(completion.content, availableChunks);

    const conversation = await upsertConversation(
      conversationId,
      documentId,
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
      action: "ai.query",
      actor: { userId, workspaceId },
      resource: { type: "document", id: documentId },
      metadata: {
        conversationId: conversation.id,
        citations: citations.length,
        tokens: usage,
      },
    });

    log.info(
      {
        documentId,
        workspaceId,
        conversationId: conversation.id,
        citations: citations.length,
        tokens: usage,
      },
      "document_query_completed",
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
      { documentId, workspaceId, userId, error: err.message },
      "document_query_failed",
    );
    throw err;
  }
}

async function upsertConversation(
  conversationId: string | undefined,
  documentId: string,
  question: string,
) {
  const scopeType: AiScopeType = "DOCUMENT";
  const title = truncateTitle(question);

  if (conversationId) {
    const existing = await prisma.aiConversation.findFirst({
      where: {
        id: conversationId,
        scopeType,
        scopeId: documentId,
      },
    });

    if (!existing) {
      throw new Error(
        `Conversation ${conversationId} not found for document ${documentId}.`,
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
      scopeId: documentId,
      title,
    },
  });
}
