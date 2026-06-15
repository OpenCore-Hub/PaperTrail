import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateShareSlug } from "@/lib/slug";
import { canManageDocuments, type UserRole } from "@/lib/roles";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createLinkSchema = z.object({
  documentId: z.string().uuid(),
  password: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  emailGate: z.boolean().default(false),
  allowDownload: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session?.user?.workspaceId ||
      !canManageDocuments(session.user.role as UserRole)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createLinkSchema.parse(body);

    const document = await prisma.document.findFirst({
      where: {
        id: parsed.documentId,
        workspaceId: session.user.workspaceId,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    let passwordHash: string | null = null;
    if (parsed.password) {
      passwordHash = await bcrypt.hash(parsed.password, 10);
    }

    const link = await prisma.shareLink.create({
      data: {
        documentId: document.id,
        slug: generateShareSlug(),
        passwordHash,
        expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
        emailGate: parsed.emailGate,
        allowDownload: parsed.allowDownload,
      },
    });

    return NextResponse.json({ slug: link.slug }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 },
      );
    }
    console.error("Create share link error:", error);
    return NextResponse.json(
      { error: "Failed to create link" },
      { status: 500 },
    );
  }
}
