import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDocumentAnalytics } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { documentId: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await getDocumentAnalytics(
      params.documentId,
      session.user.workspaceId,
    );

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch analytics";
    if (message === "Document not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("Analytics error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
