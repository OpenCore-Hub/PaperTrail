import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = viewActionSchema.parse(body);

    if (parsed.action === "start") {
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

      return NextResponse.json({ sessionId: session.id });
    }

    if (parsed.action === "heartbeat") {
      await prisma.viewSession.update({
        where: { id: parsed.sessionId },
        data: {
          durationSeconds: { increment: 5 },
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (parsed.action === "end") {
      await prisma.viewSession.update({
        where: { id: parsed.sessionId },
        data: { endedAt: new Date() },
      });
      return NextResponse.json({ ok: true });
    }

    if (parsed.action === "page") {
      await prisma.pageView.create({
        data: {
          sessionId: parsed.sessionId,
          pageNumber: parsed.pageNumber,
        },
      });
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
    console.error("View API error:", error);
    return NextResponse.json(
      { error: "Failed to process view event" },
      { status: 500 },
    );
  }
}
