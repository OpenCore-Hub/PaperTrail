import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/roles";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  role: z.enum([UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.workspaceId || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = updateSchema.parse(body);

    const target = await prisma.user.findFirst({
      where: { id: params.id, workspaceId: session.user.workspaceId },
    });
    if (!target) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Prevent removing the last admin.
    if (target.role === "ADMIN" && parsed.role !== "ADMIN") {
      const adminCount = await prisma.user.count({
        where: { workspaceId: session.user.workspaceId, role: "ADMIN" },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Workspace must keep at least one admin" },
          { status: 400 },
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: { role: parsed.role },
      select: { id: true, email: true, name: true, role: true },
    });

    return NextResponse.json({ member: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 },
      );
    }
    console.error("Member update error:", error);
    return NextResponse.json(
      { error: "Failed to update member" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.workspaceId || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const target = await prisma.user.findFirst({
      where: { id: params.id, workspaceId: session.user.workspaceId },
    });
    if (!target) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Prevent self-removal and removing the last admin.
    if (target.id === session.user.id) {
      return NextResponse.json(
        { error: "You cannot remove yourself" },
        { status: 400 },
      );
    }

    if (target.role === "ADMIN") {
      const adminCount = await prisma.user.count({
        where: { workspaceId: session.user.workspaceId, role: "ADMIN" },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Workspace must keep at least one admin" },
          { status: 400 },
        );
      }
    }

    await prisma.user.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Member delete error:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 },
    );
  }
}
