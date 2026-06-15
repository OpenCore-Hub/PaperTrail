import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/storage/factory";
import { parsePdf } from "../parsers/pdf-parser";
import { chunkDocument } from "../chunking";
import { resolveAiConfig, createAiProvider } from "../providers/factory";
import { createLogger } from "@/lib/logger";
import { audit } from "@/lib/audit";

const log = createLogger("ai:process-document");

export interface ProcessDocumentOptions {
  documentVersionId: string;
  workspaceId: string;
}

export async function processDocumentForAi({
  documentVersionId,
  workspaceId,
}: ProcessDocumentOptions): Promise<void> {
  log.info({ documentVersionId, workspaceId }, "process_document_started");

  await prisma.documentVersion.update({
    where: { id: documentVersionId },
    data: { aiStatus: "PROCESSING" },
  });

  try {
    const version = await prisma.documentVersion.findUniqueOrThrow({
      where: { id: documentVersionId },
    });
    const storage = getStorageProvider();
    const fileBuffer = await storage.getStream(version.storageKey);
    const buffer = Buffer.isBuffer(fileBuffer)
      ? fileBuffer
      : Buffer.from(await new Response(fileBuffer).arrayBuffer());

    const parsed = await parsePdf(buffer);

    const aiConfig = await prisma.aiProviderConfig.findUnique({
      where: { workspaceId },
    });

    let provider = createDefaultProvider();
    if (aiConfig) {
      const resolved = resolveAiConfig(aiConfig);
      provider = createAiProvider(resolved, {
        openaiApiKey: process.env.OPENAI_API_KEY,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        embeddingModel: "text-embedding-3-small",
      });
    }

    const chunks = chunkDocument(
      parsed.pages.map((p) => ({ pageNumber: p.pageNumber, text: p.text })),
    );

    const embeddings = await Promise.all(
      chunks.map((chunk) => provider.embed({ text: chunk.content })),
    );

    await prisma.$transaction(async (tx) => {
      await tx.documentChunk.deleteMany({
        where: { documentVersionId },
      });

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];

        await tx.$executeRaw`
          INSERT INTO document_chunks (
            id, document_version_id, content, embedding, page_number, paragraph_index, metadata
          ) VALUES (
            ${crypto.randomUUID()},
            ${documentVersionId},
            ${chunk.content},
            ${embedding}::vector,
            ${chunk.pageNumber},
            ${chunk.paragraphIndex ?? null},
            ${JSON.stringify({ source: "pdf-parse" })}::jsonb
          )
        `;
      }

      await tx.documentVersion.update({
        where: { id: documentVersionId },
        data: {
          aiStatus: "READY",
          pageCount: parsed.pageCount,
        },
      });
    });

    await audit({
      action: "ai.document_indexed",
      actor: { userId: "system", workspaceId },
      resource: { type: "documentVersion", id: documentVersionId },
      metadata: {
        chunks: chunks.length,
        pages: parsed.pageCount,
        provider: provider.id,
      },
    });

    log.info(
      { documentVersionId, chunks: chunks.length, pages: parsed.pageCount },
      "process_document_completed",
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.error(
      { documentVersionId, error: err.message },
      "process_document_failed",
    );

    await prisma.documentVersion.update({
      where: { id: documentVersionId },
      data: { aiStatus: "FAILED" },
    });

    await audit({
      action: "ai.document_index_failed",
      actor: { userId: "system", workspaceId },
      resource: { type: "documentVersion", id: documentVersionId },
      metadata: { error: err.message },
    });

    throw err;
  }
}

function createDefaultProvider() {
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
