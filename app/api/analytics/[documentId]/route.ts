import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { documentId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const document = await prisma.document.findFirst({
    where: {
      id: params.documentId,
      workspaceId: session.user.workspaceId,
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
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

  return NextResponse.json({
    document: {
      id: document.id,
      filename: document.filename,
    },
    summary: {
      totalViews,
      uniqueViewers,
      totalDuration,
      avgDuration,
    },
    chartData,
    pageViewData,
    recentSessions: allSessions.slice(0, 50).map((s) => ({
      id: s.id,
      startedAt: s.startedAt,
      durationSeconds: s.durationSeconds,
      viewerEmail: s.viewerEmail,
    })),
  });
}
