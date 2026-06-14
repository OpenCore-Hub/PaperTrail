import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function escapeCsv(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { documentId: string } },
) {
  try {
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
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    const links = await prisma.shareLink.findMany({
      where: { documentId: document.id },
      include: {
        sessions: {
          orderBy: { startedAt: "desc" },
          include: {
            pageViews: {
              orderBy: { pageNumber: "asc" },
              select: { pageNumber: true, durationSeconds: true },
            },
          },
        },
      },
    });

    const sessions = links.flatMap((link) =>
      link.sessions.map((session) => ({
        ...session,
        linkSlug: link.slug,
      })),
    );

    const rows: Array<Array<string | number | null | undefined>> = [
      [
        "Session ID",
        "Started at (UTC)",
        "Duration seconds",
        "Viewer email",
        "Fingerprint",
        "Link slug",
        "Pages viewed",
        "Page-level time seconds",
      ],
    ];

    for (const session of sessions) {
      const pageNumbers = session.pageViews.map((pv) => pv.pageNumber).join("; ");
      const pageTime = session.pageViews
        .map((pv) => `${pv.pageNumber}:${pv.durationSeconds}`)
        .join("; ");
      rows.push([
        session.id,
        session.startedAt.toISOString(),
        session.durationSeconds,
        session.viewerEmail ?? "",
        session.fingerprint,
        session.linkSlug,
        pageNumbers,
        pageTime,
      ]);
    }

    const csv = toCsv(rows);
    const filename = `${document.filename.replace(/[^a-z0-9_-]/gi, "_")}_analytics.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Analytics export error:", error);
    return NextResponse.json(
      { error: "Failed to export analytics" },
      { status: 500 },
    );
  }
}
