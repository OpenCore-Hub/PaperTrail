import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { canManageDataroom, type UserRole } from "@/lib/roles";
import { audit } from "@/lib/audit";
import { createLogger } from "@/lib/logger";

const log = createLogger("api:dataroom");

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  brand: z.record(z.string(), z.unknown()).optional().nullable(),
  customDomain: z.string().max(255).optional().nullable(),
});

async function authorizeDataroomAccess(
  dataroomId: string,
  workspaceId: string,
) {
  return prisma.dataroom.findFirst({
    where: { id: dataroomId, workspaceId },
    include: {
      folders: true,
      documents: {
        include: {
          document: { select: { id: true, filename: true } },
        },
        orderBy: { order: "asc" },
      },
    },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dataroom = await authorizeDataroomAccess(
      params.id,
      session.user.workspaceId,
    );
    if (!dataroom) {
      return NextResponse.json(
        { error: "Dataroom not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ dataroom });
  } catch (error) {
    log.error({ dataroomId: params.id, error }, "dataroom.get_failed");
    return NextResponse.json(
      { error: "Failed to load dataroom" },
      { status: 500 },
    );
  }
}

export async function PATCH(
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

    const dataroom = await authorizeDataroomAccess(
      params.id,
      session.user.workspaceId,
    );
    if (!dataroom) {
      return NextResponse.json(
        { error: "Dataroom not found" },
        { status: 404 },
      );
    }

    const body = await req.json();
    const parsed = updateSchema.parse(body);

    const updated = await prisma.dataroom.update({
      where: { id: params.id },
      data: {
        ...(parsed.name !== undefined && { name: parsed.name }),
        ...(parsed.description !== undefined && {
          description: parsed.description,
        }),
        ...(parsed.brand !== undefined && {
          brand:
            parsed.brand === null
              ? Prisma.JsonNull
              : (parsed.brand as Prisma.InputJsonValue),
        }),
        ...(parsed.customDomain !== undefined && {
          customDomain: parsed.customDomain,
        }),
      },
      include: {
        folders: true,
        documents: {
          include: {
            document: { select: { id: true, filename: true } },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    await audit({
      action: "dataroom.updated",
      actor: { userId: session.user.id, workspaceId: session.user.workspaceId },
      resource: { type: "dataroom", id: updated.id },
      metadata: {
        changed: ["name", "description", "brand", "customDomain"].filter(
          (key) => parsed[key as keyof typeof parsed] !== undefined,
        ),
      },
    });

    return NextResponse.json({ dataroom: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 },
      );
    }
    log.error({ dataroomId: params.id, error }, "dataroom.update_failed");
    return NextResponse.json(
      { error: "Failed to update dataroom" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
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

    const dataroom = await authorizeDataroomAccess(
      params.id,
      session.user.workspaceId,
    );
    if (!dataroom) {
      return NextResponse.json(
        { error: "Dataroom not found" },
        { status: 404 },
      );
    }

    await prisma.dataroom.delete({ where: { id: params.id } });

    await audit({
      action: "dataroom.deleted",
      actor: { userId: session.user.id, workspaceId: session.user.workspaceId },
      resource: { type: "dataroom", id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ dataroomId: params.id, error }, "dataroom.delete_failed");
    return NextResponse.json(
      { error: "Failed to delete dataroom" },
      { status: 500 },
    );
  }
}
