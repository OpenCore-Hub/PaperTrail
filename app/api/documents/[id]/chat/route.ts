import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { checkAiQueryAllowed } from "@/lib/ai/rate-limit";
import { askDocumentQuestion } from "@/lib/ai/query";

const log = createLogger("api:documents:chat");

const chatBodySchema = z.object({
  question: z.string().min(1).max(4000),
  conversationId: z.string().uuid().optional(),
});

export const dynamic = "force-dynamic";

interface ResolvedAuth {
  userId: string;
  workspaceId: string;
}

/**
 * GET /api/documents/[id]/chat?conversationId=<uuid>
 *
 * Load persisted messages for a document-scoped AI conversation.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const documentId = params.id;

  try {
    const auth = await resolveAuth(req, documentId);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conversationId = req.nextUrl.searchParams.get("conversationId");
    if (!conversationId) {
      return NextResponse.json({ messages: [] });
    }

    const conversation = await prisma.aiConversation.findFirst({
      where: {
        id: conversationId,
        scopeType: "DOCUMENT",
        scopeId: documentId,
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            role: true,
            content: true,
            citations: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      conversationId: conversation.id,
      title: conversation.title,
      messages: conversation.messages,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.error({ documentId, error: err.message }, "chat.get_failed");
    return NextResponse.json(
      { error: "Failed to load chat history" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/documents/[id]/chat
 *
 * Ask an AI question against a document. Accepts either an authenticated
 * workspace session or a valid viewer grant token.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const documentId = params.id;

  try {
    const body = await req.json();
    const parsed = chatBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { question, conversationId } = parsed.data;

    const auth = await resolveAuth(req, documentId);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { userId, workspaceId } = auth;

    const allowed = await checkAiQueryAllowed(workspaceId);
    if (!allowed) {
      return NextResponse.json(
        { error: "AI query rate limit exceeded" },
        { status: 429 },
      );
    }

    const document = await prisma.document.findFirst({
      where: { id: documentId, workspaceId },
    });
    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    const readyVersion = await prisma.documentVersion.findFirst({
      where: { documentId, aiStatus: "READY" },
      orderBy: { versionNumber: "desc" },
    });
    if (!readyVersion) {
      return NextResponse.json(
        {
          error:
            "Document is not yet indexed for AI. Please try again in a moment.",
        },
        { status: 503 },
      );
    }

    const result = await askDocumentQuestion({
      documentId,
      workspaceId,
      userId,
      question,
      conversationId,
    });

    return NextResponse.json({
      answer: result.answer,
      citations: result.citations,
      conversationId: result.conversationId,
      usage: result.usage,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.error({ documentId, error: err.message }, "chat.query_failed");

    if (err.message.includes("no AI-ready version")) {
      return NextResponse.json(
        {
          error:
            "Document is not yet indexed for AI. Please try again in a moment.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Failed to process AI question" },
      { status: 500 },
    );
  }
}

async function resolveAuth(
  req: NextRequest,
  documentId: string,
): Promise<ResolvedAuth | null> {
  const session = await getServerSession(authOptions);
  if (session?.user?.workspaceId) {
    const document = await prisma.document.findFirst({
      where: { id: documentId, workspaceId: session.user.workspaceId },
    });
    if (document) {
      return {
        userId: session.user.id,
        workspaceId: session.user.workspaceId,
      };
    }
  }

  const viewerToken = req.headers.get("X-Viewer-Token");
  if (viewerToken) {
    const grant = await prisma.viewerGrant.findUnique({
      where: { token: viewerToken },
      include: { link: { include: { document: true } } },
    });

    if (
      grant &&
      grant.expiresAt > new Date() &&
      grant.link.document.id === documentId
    ) {
      return {
        userId: `viewer:${grant.id}`,
        workspaceId: grant.link.document.workspaceId,
      };
    }
  }

  return null;
}
