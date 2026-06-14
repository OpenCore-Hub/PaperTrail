import { prisma } from "./prisma";

export interface AnalyticsSummary {
  totalViews: number;
  uniqueViewers: number;
  totalDuration: number;
  avgDuration: number;
}

export interface AnalyticsChartData {
  date: string;
  views: number;
}

export interface AnalyticsPageViewData {
  pageNumber: number;
  views: number;
  totalSeconds: number;
}

export interface AnalyticsRecentSession {
  id: string;
  startedAt: Date;
  durationSeconds: number;
  viewerEmail: string | null;
}

export interface AnalyticsResult {
  document: { id: string; filename: string };
  summary: AnalyticsSummary;
  chartData: AnalyticsChartData[];
  pageViewData: AnalyticsPageViewData[];
  recentSessions: AnalyticsRecentSession[];
}

/**
 * Aggregate analytics for a single document.
 *
 * Throws if the document does not exist or does not belong to the given
 * workspace.
 */
export async function getDocumentAnalytics(
  documentId: string,
  workspaceId: string,
): Promise<AnalyticsResult> {
  const document = await prisma.document.findFirst({
    where: { id: documentId, workspaceId },
    select: { id: true, filename: true },
  });

  if (!document) {
    throw new Error("Document not found");
  }

  const links = await prisma.shareLink.findMany({
    where: { documentId: document.id },
    include: {
      sessions: {
        orderBy: { startedAt: "desc" },
      },
    },
  });

  const allSessions = links.flatMap((link) => link.sessions);
  const totalViews = allSessions.length;
  const uniqueViewers = new Set(allSessions.map((s) => s.fingerprint)).size;
  const totalDuration = allSessions.reduce(
    (sum, s) => sum + s.durationSeconds,
    0,
  );
  const avgDuration =
    totalViews > 0 ? Math.round(totalDuration / totalViews) : 0;

  const viewsByDay: Record<string, number> = {};
  allSessions.forEach((session) => {
    const day = session.startedAt.toISOString().split("T")[0];
    viewsByDay[day] = (viewsByDay[day] || 0) + 1;
  });

  const chartData = Object.entries(viewsByDay)
    .map(([date, views]) => ({ date, views }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const pageViews = await prisma.pageView.groupBy({
    by: ["pageNumber"],
    where: {
      sessionId: { in: allSessions.map((s) => s.id) },
    },
    _count: { pageNumber: true },
    _sum: { durationSeconds: true },
    orderBy: { pageNumber: "asc" },
  });

  const pageViewData = pageViews.map((pv) => ({
    pageNumber: pv.pageNumber,
    views: pv._count.pageNumber,
    totalSeconds: pv._sum.durationSeconds ?? 0,
  }));

  const recentSessions = allSessions.slice(0, 50).map((s) => ({
    id: s.id,
    startedAt: s.startedAt,
    durationSeconds: s.durationSeconds,
    viewerEmail: s.viewerEmail,
  }));

  return {
    document,
    summary: {
      totalViews,
      uniqueViewers,
      totalDuration,
      avgDuration,
    },
    chartData,
    pageViewData,
    recentSessions,
  };
}
