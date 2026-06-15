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

interface SummaryRow {
  totalViews: number;
  uniqueViewers: number;
  totalDuration: number;
}

interface ChartRow {
  date: string;
  views: number;
}

interface PageViewRow {
  pageNumber: number;
  views: number;
  totalSeconds: number;
}

/**
 * Aggregate analytics for a single document.
 *
 * All heavy aggregation is pushed to PostgreSQL so the function scales with
 * large view volumes. Only the 50 most recent sessions are fetched into
 * application memory.
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

  const [summaryRows, chartRows, pageViewRows, recentSessions] =
    await Promise.all([
      // High-level summary computed entirely in the database.
      prisma.$queryRaw<SummaryRow[]>`
        SELECT
          COUNT(*)::int AS "totalViews",
          COUNT(DISTINCT vs.fingerprint)::int AS "uniqueViewers",
          COALESCE(SUM(vs.duration_seconds), 0)::int AS "totalDuration"
        FROM view_sessions vs
        JOIN share_links sl ON sl.id = vs.link_id
        WHERE sl.document_id = ${documentId}
      `,

      // Daily view counts.
      prisma.$queryRaw<ChartRow[]>`
        SELECT
          DATE(vs.started_at) AS "date",
          COUNT(*)::int AS "views"
        FROM view_sessions vs
        JOIN share_links sl ON sl.id = vs.link_id
        WHERE sl.document_id = ${documentId}
        GROUP BY DATE(vs.started_at)
        ORDER BY "date" ASC
      `,

      // Per-page engagement.
      prisma.$queryRaw<PageViewRow[]>`
        SELECT
          pv.page_number AS "pageNumber",
          COUNT(*)::int AS "views",
          COALESCE(SUM(pv.duration_seconds), 0)::int AS "totalSeconds"
        FROM page_views pv
        JOIN view_sessions vs ON vs.id = pv.session_id
        JOIN share_links sl ON sl.id = vs.link_id
        WHERE sl.document_id = ${documentId}
        GROUP BY pv.page_number
        ORDER BY "pageNumber" ASC
      `,

      // Only the most recent sessions are materialized for the UI table.
      prisma.viewSession.findMany({
        where: { link: { documentId } },
        orderBy: { startedAt: "desc" },
        take: 50,
        select: {
          id: true,
          startedAt: true,
          durationSeconds: true,
          viewerEmail: true,
        },
      }),
    ]);

  const summaryRow = summaryRows[0] ?? {
    totalViews: 0,
    uniqueViewers: 0,
    totalDuration: 0,
  };

  const avgDuration =
    summaryRow.totalViews > 0
      ? Math.round(summaryRow.totalDuration / summaryRow.totalViews)
      : 0;

  return {
    document,
    summary: {
      totalViews: summaryRow.totalViews,
      uniqueViewers: summaryRow.uniqueViewers,
      totalDuration: summaryRow.totalDuration,
      avgDuration,
    },
    chartData: chartRows.map((row) => ({
      date: new Date(row.date).toISOString().split("T")[0],
      views: row.views,
    })),
    pageViewData: pageViewRows,
    recentSessions,
  };
}
