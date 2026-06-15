import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageDocuments, type UserRole } from "@/lib/roles";
import { z } from "zod";

export const dynamic = "force-dynamic";

async function authorizeLinkAccess(linkId: string, workspaceId: string) {
  const link = await prisma.shareLink.findFirst({
    where: {
      id: linkId,
      document: { workspaceId },
    },
    include: { document: { select: { workspaceId: true } } },
  });
  return link;
}

const updateLinkSchema = z.object({
  password: z.string().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  emailGate: z.boolean().optional(),
  allowDownload: z.boolean().optional(),
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

    const link = await authorizeLinkAccess(params.id, session.user.workspaceId);
    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    return NextResponse.json({
      link: {
        id: link.id,
        slug: link.slug,
        hasPassword: link.passwordHash !== null,
        expiresAt: link.expiresAt,
        emailGate: link.emailGate,
        allowDownload: link.allowDownload,
        createdAt: link.createdAt,
        updatedAt: link.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get link error:", error);
    return NextResponse.json(
      { error: "Failed to fetch link" },
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
      !canManageDocuments(session.user.role as UserRole)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const link = await authorizeLinkAccess(params.id, session.user.workspaceId);
    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = updateLinkSchema.parse(body);

    let passwordHash: string | null | undefined = undefined;
    if (parsed.password !== undefined) {
      passwordHash = parsed.password
        ? await bcrypt.hash(parsed.password, 10)
        : null;
    }

    const updated = await prisma.shareLink.update({
      where: { id: params.id },
      data: {
        ...(passwordHash !== undefined && { passwordHash }),
        ...(parsed.expiresAt !== undefined && {
          expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
        }),
        ...(parsed.emailGate !== undefined && { emailGate: parsed.emailGate }),
        ...(parsed.allowDownload !== undefined && {
          allowDownload: parsed.allowDownload,
        }),
      },
    });

    return NextResponse.json({
      link: {
        id: updated.id,
        slug: updated.slug,
        hasPassword: updated.passwordHash !== null,
        expiresAt: updated.expiresAt,
        emailGate: updated.emailGate,
        allowDownload: updated.allowDownload,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 },
      );
    }
    console.error("Update link error:", error);
    return NextResponse.json(
      { error: "Failed to update link" },
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
      !canManageDocuments(session.user.role as UserRole)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const link = await authorizeLinkAccess(params.id, session.user.workspaceId);
    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    await prisma.shareLink.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete link error:", error);
    return NextResponse.json(
      { error: "Failed to delete link" },
      { status: 500 },
    );
  }
}
