import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { teamInviteCounter, withMetrics } from "@/lib/metrics";
import { enforceRateLimit, RateLimits } from "@/lib/rate-limit";

const log = createLogger("api:team:invite");

export const dynamic = "force-dynamic";

async function handler(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.workspaceId || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await enforceRateLimit(
      req,
      "team:invite:cancel",
      RateLimits.invite,
      session.user.id,
    );
    if (!rateLimit.allowed) {
      return rateLimit.response!;
    }

    const invite = await prisma.workspaceInvite.findFirst({
      where: {
        id: params.id,
        workspaceId: session.user.workspaceId,
        acceptedAt: null,
      },
    });
    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    await prisma.workspaceInvite.delete({ where: { id: params.id } });

    teamInviteCounter.inc({ operation: "cancelled" });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ error }, "team.invite_cancel_failed");
    return NextResponse.json(
      { error: "Failed to cancel invite" },
      { status: 500 },
    );
  }
}

export const DELETE = withMetrics("/api/team/invite/[id]", handler);
