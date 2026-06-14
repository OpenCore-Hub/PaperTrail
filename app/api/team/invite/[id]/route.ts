import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.workspaceId || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const invite = await prisma.workspaceInvite.findFirst({
      where: {
        id: params.id,
        workspaceId: session.user.workspaceId,
        acceptedAt: null,
      },
    });
    if (!invite) {
      return NextResponse.json(
        { error: "Invite not found" },
        { status: 404 },
      );
    }

    await prisma.workspaceInvite.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Invite delete error:", error);
    return NextResponse.json(
      { error: "Failed to cancel invite" },
      { status: 500 },
    );
  }
}
