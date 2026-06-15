import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAllowed } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/ip";
import { createLogger } from "@/lib/logger";
import { viewEventCounter, withMetrics } from "@/lib/metrics";
import { z } from "zod";

const log = createLogger("api:view");

export const dynamic = "force-dynamic";

// Rate limits for analytics event ingestion.
const START_RATE_LIMIT = { maxRequests: 20, windowMs: 60 * 1000 };
const ACTION_RATE_LIMIT = { maxRequests: 60, windowMs: 60 * 1000 };

const viewActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    linkId: z.string().uuid(),
    viewerToken: z.string().min(1),
    viewerEmail: z.string().email().optional(),
    fingerprint: z.string().optional(),
  }),
  z.object({
    action: z.literal("heartbeat"),
    sessionId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("end"),
    sessionId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("page"),
    sessionId: z.string().uuid(),
    pageNumber: z.number().int(),
  }),
]);

async function handler(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = viewActionSchema.parse(body);

    const clientIp = getClientIp(req);

    if (parsed.action === "start") {
      const rateLimitKey = `view:start:${clientIp}`;
      if (!(await isAllowed(rateLimitKey, START_RATE_LIMIT))) {
        return NextResponse.json(
          { error: "Rate limit exceeded" },
          { status: 429 },
        );
      }
      const grant = await prisma.viewerGrant.findUnique({
        where: { token: parsed.viewerToken },
        include: { link: true },
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

      const fingerprint = parsed.fingerprint ?? "anonymous";

      const session = await prisma.viewSession.create({
        data: {
          linkId: link.id,
          fingerprint,
          viewerEmail: parsed.viewerEmail ?? null,
        },
      });

      viewEventCounter.inc({ action: "start" });
      return NextResponse.json({ sessionId: session.id });
    }

    if (parsed.action === "heartbeat") {
      const key = `view:action:${parsed.sessionId}`;
      if (!(await isAllowed(key, ACTION_RATE_LIMIT))) {
        return NextResponse.json(
          { error: "Rate limit exceeded" },
          { status: 429 },
        );
      }
      await prisma.viewSession.update({
        where: { id: parsed.sessionId },
        data: {
          durationSeconds: { increment: 5 },
        },
      });
      viewEventCounter.inc({ action: "heartbeat" });
      return NextResponse.json({ ok: true });
    }

    if (parsed.action === "end") {
      const key = `view:action:${parsed.sessionId}`;
      if (!(await isAllowed(key, ACTION_RATE_LIMIT))) {
        return NextResponse.json(
          { error: "Rate limit exceeded" },
          { status: 429 },
        );
      }
      await prisma.viewSession.update({
        where: { id: parsed.sessionId },
        data: { endedAt: new Date() },
      });
      viewEventCounter.inc({ action: "end" });
      return NextResponse.json({ ok: true });
    }

    if (parsed.action === "page") {
      const key = `view:action:${parsed.sessionId}`;
      if (!(await isAllowed(key, ACTION_RATE_LIMIT))) {
        return NextResponse.json(
          { error: "Rate limit exceeded" },
          { status: 429 },
        );
      }
      if (parsed.pageNumber < 1) {
        return NextResponse.json(
          { error: "Invalid page number" },
          { status: 400 },
        );
      }
      await prisma.pageView.create({
        data: {
          sessionId: parsed.sessionId,
          pageNumber: parsed.pageNumber,
        },
      });
      viewEventCounter.inc({ action: "page" });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 },
      );
    }
    log.error({ error }, "view.event_failed");
    return NextResponse.json(
      { error: "Failed to process view event" },
      { status: 500 },
    );
  }
}

export const POST = withMetrics("/api/view", handler);
