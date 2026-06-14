import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pdfCache } from "@/lib/pdf-cache";
import { createLogger } from "@/lib/logger";

const log = createLogger("api:cron:cleanup");

export const dynamic = "force-dynamic";

/**
 * Maximum age of an active (not yet ended) view session in hours.
 *
 * If a viewer closes the tab without sending the "end" heartbeat (e.g. mobile
 * browser, crash, network loss), the session would otherwise accumulate
 * duration forever. This cap closes stale sessions so analytics stay bounded.
 */
const MAX_SESSION_AGE_HOURS = 4;

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

function hoursAgo(hours: number): Date {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return d;
}

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

    // Close sessions that have been open too long without an end heartbeat.
    // This prevents infinitely accumulating duration when a viewer's browser
    // fails to send the final event.
    const staleSessionCutoff = hoursAgo(MAX_SESSION_AGE_HOURS);
    const closedStaleSessionsResult = await prisma.viewSession.updateMany({
      where: {
        endedAt: null,
        startedAt: { lt: staleSessionCutoff },
      },
      data: {
        endedAt: new Date(),
      },
    });

    const oldSessionsResult = await prisma.viewSession.deleteMany({
      where: {
        startedAt: { lt: sessionsCutoff },
      },
    });

    const pdfCacheCleanup = await pdfCache.cleanup();

    return NextResponse.json({
      ok: true,
      deletedExpiredLinks: expiredLinksResult.count,
      closedStaleSessions: closedStaleSessionsResult.count,
      deletedOldSessions: oldSessionsResult.count,
      deletedPdfCacheEntries: pdfCacheCleanup.deleted,
    });
  } catch (error) {
    log.error({ error }, "cleanup.failed");
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
