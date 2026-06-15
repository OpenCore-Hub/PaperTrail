import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { checkAiQueryAllowed } from "@/lib/ai/rate-limit";
import { askDataroomQuestion } from "@/lib/ai/dataroom-chat";
import { isDataroomIntelligenceAllowed } from "@/lib/plans";

const log = createLogger("api:datarooms:chat");

const chatBodySchema = z.object({
  question: z.string().min(1).max(4000),
  conversationId: z.string().uuid().optional(),
  documentIds: z.array(z.string().uuid()).max(50).optional(),
});

export const dynamic = "force-dynamic";

interface ResolvedAuth {
  userId: string;
  workspaceId: string;
}

/**
 * GET /api/datarooms/[id]/chat?conversationId=<uuid>
 *
 * Load persisted messages for a dataroom-scoped AI conversation.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const dataroomId = params.id;

  try {
    const auth = await resolveAuth(req, dataroomId);
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
        scopeType: "DATAROOM",
        scopeId: dataroomId,
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
    log.error({ dataroomId, error: err.message }, "chat.get_failed");
    return NextResponse.json(
      { error: "Failed to load chat history" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/datarooms/[id]/chat
 *
 * Ask an AI question across the documents in a dataroom. Accepts either an
 * authenticated workspace session or a valid viewer grant token for a share
 * link scoped to this dataroom.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const dataroomId = params.id;

  try {
    const body = await req.json();
    const parsed = chatBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { question, conversationId, documentIds } = parsed.data;

    const auth = await resolveAuth(req, dataroomId);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { userId, workspaceId } = auth;

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { plan: true },
    });

    if (!workspace || !isDataroomIntelligenceAllowed(workspace.plan)) {
      return NextResponse.json(
        { error: "Dataroom intelligence is not available on the free plan" },
        { status: 403 },
      );
    }

    const allowed = await checkAiQueryAllowed(workspaceId);
    if (!allowed) {
      return NextResponse.json(
        { error: "AI query rate limit exceeded" },
        { status: 429 },
      );
    }

    const result = await askDataroomQuestion({
      dataroomId,
      workspaceId,
      userId,
      question,
      conversationId,
      documentIds,
    });

    return NextResponse.json({
      answer: result.answer,
      citations: result.citations,
      conversationId: result.conversationId,
      usage: result.usage,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.error({ dataroomId, error: err.message }, "chat.query_failed");

    if (
      err.message.includes("no AI-ready documents") ||
      err.message.includes("documents without AI-ready versions") ||
      err.message.includes("no indexed chunks")
    ) {
      return NextResponse.json(
        {
          error:
            "Dataroom documents are not yet indexed for AI. Please try again in a moment.",
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
  dataroomId: string,
): Promise<ResolvedAuth | null> {
  const session = await getServerSession(authOptions);
  if (session?.user?.workspaceId) {
    const dataroom = await prisma.dataroom.findFirst({
      where: { id: dataroomId, workspaceId: session.user.workspaceId },
    });
    if (dataroom) {
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
      include: {
        link: {
          include: {
            dataroom: {
              select: { id: true, workspaceId: true },
            },
          },
        },
      },
    });

    if (
      grant &&
      grant.expiresAt > new Date() &&
      grant.link.dataroom &&
      grant.link.dataroom.id === dataroomId
    ) {
      return {
        userId: `viewer:${grant.id}`,
        workspaceId: grant.link.dataroom.workspaceId,
      };
    }
  }

  return null;
}
