import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { canManageDocuments, type UserRole } from "@/lib/roles";
import { getLatestVersionOrThrow } from "@/lib/documents/get-latest-version";
import { getStorageProvider } from "@/lib/storage/factory";

const log = createLogger("api:documents");

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session?.user?.workspaceId ||
      !canManageDocuments(session.user.role as UserRole)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      const version = await getLatestVersionOrThrow(document.id);
      const storage = getStorageProvider();
      await storage.delete(version.storageKey);
    } catch (storageError) {
      log.error(
        { documentId: params.id, error: storageError },
        "documents.storage_cleanup_failed",
      );
    }

    await prisma.document.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ documentId: params.id, error }, "documents.delete_failed");
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 },
    );
  }
}
