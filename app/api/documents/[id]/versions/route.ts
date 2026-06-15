import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { canManageDocuments, type UserRole } from "@/lib/roles";
import { getStorageProvider } from "@/lib/storage/factory";
import { audit } from "@/lib/audit";
import { enqueueProcessDocumentForAi } from "@/lib/ai/jobs/queue";

const log = createLogger("api:documents:versions");

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.workspaceId) {
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

    const versions = await prisma.documentVersion.findMany({
      where: { documentId: params.id },
      orderBy: { versionNumber: "desc" },
    });

    return NextResponse.json({ versions });
  } catch (error) {
    log.error({ documentId: params.id, error }, "versions.list_failed");
    return NextResponse.json(
      { error: "Failed to list versions" },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
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

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing or invalid file" },
        { status: 400 },
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const MAX_APP_SIZE_BYTES = 20 * 1024 * 1024;
    if (buffer.length > MAX_APP_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File exceeds 20MB app limit" },
        { status: 413 },
      );
    }

    const storage = getStorageProvider();
    const result = await storage.put(buffer, {
      contentType: file.type,
      filename: file.name,
      workspaceId: session.user.workspaceId,
      uploaderId: session.user.id,
    });

    const latestVersion = await prisma.documentVersion.findFirst({
      where: { documentId: params.id },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });

    const version = await prisma.documentVersion.create({
      data: {
        documentId: params.id,
        versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
        storageKey: result.key,
        storageType: "UPLOADTHING",
        fileSize: result.size,
        contentType: result.contentType,
        createdBy: session.user.id,
      },
    });

    await audit({
      action: "document.version.created",
      actor: { userId: session.user.id, workspaceId: session.user.workspaceId },
      resource: { type: "document", id: params.id },
      metadata: { versionId: version.id, versionNumber: version.versionNumber },
    });

    await enqueueProcessDocumentForAi({
      documentVersionId: version.id,
      workspaceId: session.user.workspaceId,
    });

    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    log.error({ documentId: params.id, error }, "versions.create_failed");
    return NextResponse.json(
      { error: "Failed to create version" },
      { status: 500 },
    );
  }
}
