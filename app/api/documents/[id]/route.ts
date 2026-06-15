import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRequestLogger } from "@/lib/logger";
import { audit } from "@/lib/audit";
import { withRequestContext } from "@/lib/with-request-context";
import { enforceRateLimit, RateLimits } from "@/lib/rate-limit";
import { canManageDocuments, type UserRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

async function handler(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const log = getRequestLogger("api:documents");

  try {
    const session = await getServerSession(authOptions);
    if (
      !session?.user?.workspaceId ||
      !canManageDocuments(session.user.role as UserRole)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await enforceRateLimit(
      req,
      "document:delete",
      RateLimits.documentMutation,
      session.user.id,
    );
    if (!rateLimit.allowed) {
      return rateLimit.response!;
    }

    const document = await prisma.document.findFirst({
      where: {
        id: params.id,
        workspaceId: session.user.workspaceId,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    // Best-effort cleanup of the stored PDF. The DB row is deleted even if
    // storage cleanup fails so the user is not stuck with an undeletable doc.
    try {
      const { UTApi } = await import("uploadthing/server");
      const utapi = new UTApi();
      await utapi.deleteFiles(document.storageKey);
    } catch (storageError) {
      log.error(
        { documentId: params.id, error: storageError },
        "documents.storage_cleanup_failed",
      );
    }

    await prisma.document.delete({ where: { id: params.id } });

    audit("document.deleted", {
      documentId: params.id,
      workspaceId: session.user.workspaceId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ documentId: params.id, error }, "documents.delete_failed");
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 },
    );
  }
}

export const DELETE = withRequestContext(handler);
