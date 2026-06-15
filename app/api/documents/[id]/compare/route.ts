import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { audit } from "@/lib/audit";
import { getStorageProvider } from "@/lib/storage/factory";
import { parsePdf } from "@/lib/ai/parsers/pdf-parser";
import { resolveAiConfig, createAiProvider } from "@/lib/ai/providers/factory";

const log = createLogger("api:documents:compare");

const compareBodySchema = z.object({
  baseVersionId: z.string().uuid(),
  targetVersionId: z.string().uuid(),
});

export const dynamic = "force-dynamic";

interface CompareSection {
  title: string;
  status: "added" | "removed" | "modified" | "unchanged";
  baseText?: string;
  targetText?: string;
  riskLevel?: "low" | "medium" | "high";
  notes?: string;
}

interface NumericChange {
  label: string;
  baseValue: number;
  targetValue: number;
}

interface CompareResult {
  sections: CompareSection[];
  numericChanges: NumericChange[];
  summary: string;
}

/**
 * POST /api/documents/[id]/compare
 *
 * Compare two versions of a document using an AI provider. Returns a structured
 * diff with sections, numeric change extraction, and a plain-language summary.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const documentId = params.id;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const document = await prisma.document.findFirst({
      where: { id: documentId, workspaceId: session.user.workspaceId },
    });
    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    const body = await req.json();
    const parsed = compareBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { baseVersionId, targetVersionId } = parsed.data;

    if (baseVersionId === targetVersionId) {
      return NextResponse.json(
        { error: "Cannot compare a version to itself" },
        { status: 400 },
      );
    }

    const versions = await prisma.documentVersion.findMany({
      where: {
        id: { in: [baseVersionId, targetVersionId] },
        documentId,
      },
    });

    const baseVersion = versions.find((v) => v.id === baseVersionId);
    const targetVersion = versions.find((v) => v.id === targetVersionId);

    if (!baseVersion || !targetVersion) {
      return NextResponse.json(
        { error: "One or both versions do not belong to this document" },
        { status: 404 },
      );
    }

    const storage = getStorageProvider();

    const [baseStream, targetStream] = await Promise.all([
      storage.getStream(baseVersion.storageKey),
      storage.getStream(targetVersion.storageKey),
    ]);

    const [baseBuffer, targetBuffer] = await Promise.all([
      streamToBuffer(baseStream),
      streamToBuffer(targetStream),
    ]);

    const [baseParsed, targetParsed] = await Promise.all([
      parsePdf(baseBuffer),
      parsePdf(targetBuffer),
    ]);

    const totalPages = baseParsed.pageCount + targetParsed.pageCount;
    const totalTokens = Math.ceil(
      (baseParsed.pages.reduce((sum, p) => sum + p.text.length, 0) +
        targetParsed.pages.reduce((sum, p) => sum + p.text.length, 0)) /
        4,
    );

    if (totalPages > 200 || totalTokens > 100_000) {
      return NextResponse.json(
        {
          error:
            "Documents too large for AI comparison. Try comparing smaller versions or fewer pages.",
        },
        { status: 400 },
      );
    }

    const aiProviderConfig = await prisma.aiProviderConfig.findUnique({
      where: { workspaceId: session.user.workspaceId },
    });

    const provider = aiProviderConfig
      ? createAiProvider(resolveAiConfig(aiProviderConfig), {
          openaiApiKey: process.env.OPENAI_API_KEY,
          anthropicApiKey: process.env.ANTHROPIC_API_KEY,
          embeddingModel: "text-embedding-3-small",
        })
      : createAiProvider(
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

    const baseText = baseParsed.pages
      .map((p) => `Page ${p.pageNumber}:\n${p.text}`)
      .join("\n\n");
    const targetText = targetParsed.pages
      .map((p) => `Page ${p.pageNumber}:\n${p.text}`)
      .join("\n\n");

    const systemPrompt = `You are a precise document comparison assistant. Compare the BASE and TARGET versions of a document and produce a structured JSON response.

Respond with valid JSON in this exact shape:
{
  "sections": [
    {
      "title": "Section title",
      "status": "added" | "removed" | "modified" | "unchanged",
      "baseText": "Relevant text from base (omit for added)",
      "targetText": "Relevant text from target (omit for removed)",
      "riskLevel": "low" | "medium" | "high",
      "notes": "Optional explanation"
    }
  ],
  "numericChanges": [
    { "label": "e.g. Total amount", "baseValue": 100, "targetValue": 120 }
  ],
  "summary": "A concise plain-language summary of the comparison."
}`;

    const completion = await provider.complete({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `BASE VERSION:\n${baseText}\n\n---\n\nTARGET VERSION:\n${targetText}`,
        },
      ],
      temperature: 0.2,
      maxTokens: 4096,
    });

    let result: CompareResult;
    try {
      result = JSON.parse(completion.content) as CompareResult;
    } catch {
      log.error(
        { documentId, baseVersionId, targetVersionId, raw: completion.content },
        "compare.parse_failed",
      );
      return NextResponse.json(
        { error: "AI comparison returned invalid JSON" },
        { status: 500 },
      );
    }

    await audit({
      action: "document.compared",
      actor: {
        userId: session.user.id,
        workspaceId: session.user.workspaceId,
      },
      resource: { type: "document", id: documentId },
      metadata: {
        baseVersionId,
        targetVersionId,
        sections: result.sections.length,
      },
    });

    log.info(
      {
        documentId,
        baseVersionId,
        targetVersionId,
        sections: result.sections.length,
      },
      "compare.completed",
    );

    return NextResponse.json(result);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.error({ documentId, error: err.message }, "compare.failed");
    return NextResponse.json(
      { error: "Failed to compare document versions" },
      { status: 500 },
    );
  }
}

async function streamToBuffer(
  stream: ReadableStream<Uint8Array> | Buffer,
): Promise<Buffer> {
  if (Buffer.isBuffer(stream)) {
    return stream;
  }

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}
