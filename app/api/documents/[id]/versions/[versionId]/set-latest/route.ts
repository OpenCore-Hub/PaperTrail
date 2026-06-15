import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { canManageDocuments, type UserRole } from "@/lib/roles";
import { audit } from "@/lib/audit";

const log = createLogger("api:documents:versions:set-latest");

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; versionId: string } },
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

    const targetVersion = await prisma.documentVersion.findFirst({
      where: {
        id: params.versionId,
        documentId: params.id,
      },
    });

    if (!targetVersion) {
      return NextResponse.json(
        { error: "Version not found" },
        { status: 404 },
      );
    }

    const latestVersion = await prisma.documentVersion.findFirst({
      where: { documentId: params.id },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });

    const newVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;

    const version = await prisma.documentVersion.update({
      where: { id: params.versionId },
      data: { versionNumber: newVersionNumber },
    });

    await audit({
      action: "document.version.set_latest",
      actor: { userId: session.user.id, workspaceId: session.user.workspaceId },
      resource: { type: "document", id: params.id },
      metadata: {
        versionId: version.id,
        oldVersionNumber: targetVersion.versionNumber,
        newVersionNumber,
      },
    });

    return NextResponse.json({ version });
  } catch (error) {
    log.error({ documentId: params.id, error }, "versions.set_latest_failed");
    return NextResponse.json(
      { error: "Failed to set latest version" },
      { status: 500 },
    );
  }
}
