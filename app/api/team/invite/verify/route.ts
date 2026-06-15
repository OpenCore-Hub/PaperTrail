import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestLogger } from "@/lib/logger";
import { withRequestContext } from "@/lib/with-request-context";

export const dynamic = "force-dynamic";

async function handler(req: NextRequest) {
  const log = getRequestLogger("api:team:invite:verify");

  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const invite = await prisma.workspaceInvite.findUnique({
      where: { token },
      include: { workspace: true },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (invite.acceptedAt) {
      return NextResponse.json(
        { error: "Invite already used" },
        { status: 410 },
      );
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invite expired" }, { status: 410 });
    }

    return NextResponse.json({
      invite: {
        email: invite.email,
        role: invite.role,
        workspaceName: invite.workspace.name,
      },
    });
  } catch (error) {
    log.error({ error }, "team.invite_verify_failed");
    return NextResponse.json(
      { error: "Failed to verify invite" },
      { status: 500 },
    );
  }
}

export const GET = withRequestContext(handler);
