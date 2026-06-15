import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { canManageDataroom, type UserRole } from "@/lib/roles";
import { audit } from "@/lib/audit";
import { createLogger } from "@/lib/logger";

const log = createLogger("api:datarooms");

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const datarooms = await prisma.dataroom.findMany({
      where: { workspaceId: session.user.workspaceId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { documents: true, folders: true },
        },
      },
    });

    return NextResponse.json({ datarooms });
  } catch (error) {
    log.error({ error }, "datarooms.list_failed");
    return NextResponse.json(
      { error: "Failed to list datarooms" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session?.user?.workspaceId ||
      !canManageDataroom(session.user.role as UserRole)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createSchema.parse(body);

    const dataroom = await prisma.dataroom.create({
      data: {
        workspaceId: session.user.workspaceId,
        name: parsed.name,
        description: parsed.description,
      },
      include: {
        _count: {
          select: { documents: true, folders: true },
        },
      },
    });

    await audit({
      action: "dataroom.created",
      actor: { userId: session.user.id, workspaceId: session.user.workspaceId },
      resource: { type: "dataroom", id: dataroom.id },
      metadata: { name: dataroom.name },
    });

    return NextResponse.json({ dataroom }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 },
      );
    }
    log.error({ error }, "datarooms.create_failed");
    return NextResponse.json(
      { error: "Failed to create dataroom" },
      { status: 500 },
    );
  }
}
