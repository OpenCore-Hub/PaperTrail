import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const document = await prisma.document.findFirst({
    where: {
      id: params.id,
      workspaceId: session.user.workspaceId,
    },
    include: {
      links: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          slug: true,
          passwordHash: true,
          expiresAt: true,
          emailGate: true,
          allowDownload: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!document) {
    return NextResponse.json(
      { error: "Document not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    links: document.links.map((link) => ({
      ...link,
      hasPassword: link.passwordHash !== null,
      passwordHash: undefined,
    })),
  });
}
