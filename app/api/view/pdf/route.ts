import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pdfCache } from "@/lib/pdf-cache";
import { createLogger } from "@/lib/logger";
import { pdfCacheCounter, withMetrics } from "@/lib/metrics";

const log = createLogger("api:view:pdf");

export const dynamic = "force-dynamic";

// How long the browser/CDN may cache a successfully authenticated PDF response.
const CLIENT_CACHE_MAX_AGE_SECONDS = 60;

async function handler(req: NextRequest) {
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

    // Refresh the grant while the viewer is actively loading the PDF so that
    // legitimate long reading sessions are not interrupted.
    const refreshedExpiresAt = new Date(
      Date.now() + CLIENT_CACHE_MAX_AGE_SECONDS * 1000 + 60 * 60 * 1000,
    );
    await prisma.viewerGrant.update({
      where: { id: grant.id },
      data: { expiresAt: refreshedExpiresAt },
    });

    if (download && !link.allowDownload) {
      return NextResponse.json(
        { error: "Download not allowed" },
        { status: 403 },
      );
    }

    const { document } = link;

    // Check the server-side cache first to avoid repeated UploadThing fetches.
    const cached = await pdfCache.get(document.storageKey);
    if (cached) {
      log.debug({ storageKey: document.storageKey }, "pdf.serve_from_cache");
      pdfCacheCounter.inc({ outcome: "hit" });
      const headers = new Headers();
      headers.set("Content-Type", cached.metadata.contentType);
      headers.set(
        "Content-Disposition",
        `${download ? "attachment" : "inline"}; filename="${cached.metadata.filename}"`,
      );
      headers.set(
        "Cache-Control",
        `private, max-age=${CLIENT_CACHE_MAX_AGE_SECONDS}`,
      );
      return new NextResponse(new Uint8Array(cached.buffer), {
        status: 200,
        headers,
      });
    }

    const fileUrl = `https://utfs.io/f/${document.storageKey}`;

    const upstream = await fetch(fileUrl);
    if (!upstream.ok) {
      log.error(
        { storageKey: document.storageKey, status: upstream.status },
        "pdf.upstream_fetch_failed",
      );
      pdfCacheCounter.inc({ outcome: "upstream_error" });
      return NextResponse.json(
        { error: "Failed to load document" },
        { status: 502 },
      );
    }

    const contentType =
      upstream.headers.get("content-type") ?? "application/pdf";
    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await pdfCache.set(document.storageKey, buffer, {
      filename: document.filename,
      contentType,
      size: buffer.length,
    });

    pdfCacheCounter.inc({ outcome: "miss" });

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set(
      "Content-Disposition",
      `${download ? "attachment" : "inline"}; filename="${document.filename}"`,
    );
    headers.set(
      "Cache-Control",
      `private, max-age=${CLIENT_CACHE_MAX_AGE_SECONDS}`,
    );

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers,
    });
  } catch (error) {
    log.error({ error }, "pdf.serve_failed");
    pdfCacheCounter.inc({ outcome: "error" });
    return NextResponse.json(
      { error: "Failed to serve document" },
      { status: 500 },
    );
  }
}

export const GET = withMetrics("/api/view/pdf", handler);
