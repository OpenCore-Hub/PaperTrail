import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { canManageDataroom, type UserRole } from "@/lib/roles";
import { audit } from "@/lib/audit";
import { createLogger } from "@/lib/logger";

const log = createLogger("api:dataroom:folders");

export const dynamic = "force-dynamic";

const createFolderSchema = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().uuid().optional(),
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

    const folders = await prisma.dataroomFolder.findMany({
      where: { dataroomId: params.id },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ folders });
  } catch (error) {
    log.error({ dataroomId: params.id, error }, "dataroom.folders.list_failed");
    return NextResponse.json(
      { error: "Failed to list folders" },
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
    const parsed = createFolderSchema.parse(body);

    if (parsed.parentId) {
      const parent = await prisma.dataroomFolder.findFirst({
        where: { id: parsed.parentId, dataroomId: params.id },
      });
      if (!parent) {
        return NextResponse.json(
          { error: "Parent folder not found" },
          { status: 400 },
        );
      }
    }

    const folder = await prisma.dataroomFolder.create({
      data: {
        dataroomId: params.id,
        parentId: parsed.parentId ?? null,
        name: parsed.name,
      },
    });

    await audit({
      action: "dataroom.folder.created",
      actor: { userId: session.user.id, workspaceId: session.user.workspaceId },
      resource: { type: "dataroom_folder", id: folder.id },
      metadata: { dataroomId: params.id, parentId: parsed.parentId },
    });

    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 },
      );
    }
    log.error(
      { dataroomId: params.id, error },
      "dataroom.folder.create_failed",
    );
    return NextResponse.json(
      { error: "Failed to create folder" },
      { status: 500 },
    );
  }
}
