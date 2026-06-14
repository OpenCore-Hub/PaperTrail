import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const download = searchParams.get("download") === "1";

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const grant = await prisma.viewerGrant.findUnique({
      where: { token },
      include: {
        link: {
          include: { document: true },
        },
      },
    });

    if (!grant || grant.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Access expired or invalid" },
        { status: 401 },
      );
    }

    const { link } = grant;

    if (link.expiresAt && new Date() > link.expiresAt) {
      return NextResponse.json({ error: "Link expired" }, { status: 410 });
    }

    if (download && !link.allowDownload) {
      return NextResponse.json(
        { error: "Download not allowed" },
        { status: 403 },
      );
    }

    const { document } = link;
    const fileUrl = `https://utfs.io/f/${document.storageKey}`;

    const upstream = await fetch(fileUrl);
    if (!upstream.ok) {
      console.error("Failed to fetch PDF from storage", upstream.status);
      return NextResponse.json(
        { error: "Failed to load document" },
        { status: 502 },
      );
    }

    const headers = new Headers();
    headers.set("Content-Type", "application/pdf");
    headers.set(
      "Content-Disposition",
      `${download ? "attachment" : "inline"}; filename="${document.filename}"`,
    );

    const cacheControl = upstream.headers.get("cache-control");
    if (cacheControl) {
      headers.set("Cache-Control", cacheControl);
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("PDF proxy error:", error);
    return NextResponse.json(
      { error: "Failed to serve document" },
      { status: 500 },
    );
  }
}
