import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { canManageDataroom, type UserRole } from "@/lib/roles";
import { audit } from "@/lib/audit";
import { createLogger } from "@/lib/logger";

const log = createLogger("api:dataroom:documents");

export const dynamic = "force-dynamic";

const mountSchema = z.object({
  documentId: z.string().uuid(),
  folderId: z.string().uuid().optional(),
  order: z.number().int().default(0),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dataroom = await prisma.dataroom.findFirst({
      where: { id: params.id, workspaceId: session.user.workspaceId },
    });
    if (!dataroom) {
      return NextResponse.json(
        { error: "Dataroom not found" },
        { status: 404 },
      );
    }

    const documents = await prisma.dataroomDocument.findMany({
      where: { dataroomId: params.id },
      orderBy: { order: "asc" },
      include: {
        document: {
          select: {
            id: true,
            filename: true,
            pageCount: true,
            createdAt: true,
          },
        },
        folder: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ documents });
  } catch (error) {
    log.error(
      { dataroomId: params.id, error },
      "dataroom.documents.list_failed",
    );
    return NextResponse.json(
      { error: "Failed to list documents" },
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
      !canManageDataroom(session.user.role as UserRole)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dataroom = await prisma.dataroom.findFirst({
      where: { id: params.id, workspaceId: session.user.workspaceId },
    });
    if (!dataroom) {
      return NextResponse.json(
        { error: "Dataroom not found" },
        { status: 404 },
      );
    }

    const body = await req.json();
    const parsed = mountSchema.parse(body);

    const document = await prisma.document.findFirst({
      where: { id: parsed.documentId, workspaceId: session.user.workspaceId },
    });
    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    if (parsed.folderId) {
      const folder = await prisma.dataroomFolder.findFirst({
        where: { id: parsed.folderId, dataroomId: params.id },
      });
      if (!folder) {
        return NextResponse.json(
          { error: "Folder not found" },
          { status: 400 },
        );
      }
    }

    const mounted = await prisma.dataroomDocument.create({
      data: {
        dataroomId: params.id,
        folderId: parsed.folderId ?? null,
        documentId: parsed.documentId,
        order: parsed.order,
      },
      include: {
        document: {
          select: {
            id: true,
            filename: true,
            pageCount: true,
            createdAt: true,
          },
        },
      },
    });

    await audit({
      action: "dataroom.document.mounted",
      actor: { userId: session.user.id, workspaceId: session.user.workspaceId },
      resource: { type: "dataroom_document", id: mounted.id },
      metadata: { dataroomId: params.id, documentId: parsed.documentId },
    });

    return NextResponse.json({ document: mounted }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 },
      );
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Document already mounted" },
        { status: 409 },
      );
    }
    log.error(
      { dataroomId: params.id, error },
      "dataroom.document.mount_failed",
    );
    return NextResponse.json(
      { error: "Failed to mount document" },
      { status: 500 },
    );
  }
}
