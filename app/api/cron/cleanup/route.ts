import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Retention windows in days.
 *
 * - Expired links: kept for 30 days after expiration so owners can renew them,
 *   then hard-deleted along with their sessions and grants.
 * - View sessions: kept for 90 days for analytics, then deleted along with
 *   their page views.
 */
const EXPIRED_LINK_RETENTION_DAYS = 30;
const VIEW_SESSION_RETENTION_DAYS = 90;

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (secret) {
    const token = authHeader?.replace("Bearer ", "");
    if (token !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    // Without CRON_SECRET the endpoint is disabled to prevent accidental
    // exposure in production.
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }

  try {
    const expiredLinksCutoff = daysAgo(EXPIRED_LINK_RETENTION_DAYS);
    const sessionsCutoff = daysAgo(VIEW_SESSION_RETENTION_DAYS);

    const expiredLinksResult = await prisma.shareLink.deleteMany({
      where: {
        expiresAt: { not: null, lt: expiredLinksCutoff },
      },
    });

    const oldSessionsResult = await prisma.viewSession.deleteMany({
      where: {
        startedAt: { lt: sessionsCutoff },
      },
    });

    return NextResponse.json({
      ok: true,
      deletedExpiredLinks: expiredLinksResult.count,
      deletedOldSessions: oldSessionsResult.count,
    });
  } catch (error) {
    console.error("Cleanup cron error:", error);
    return NextResponse.json(
      { error: "Cleanup failed" },
      { status: 500 },
    );
  }
}
