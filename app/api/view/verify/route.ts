import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { customAlphabet } from "nanoid";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const verifySchema = z.object({
  linkId: z.string().uuid(),
  password: z.string().optional(),
  viewerEmail: z.string().email().optional(),
});

// 5-minute viewer access grant
const GRANT_TTL_MINUTES = 5;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = verifySchema.parse(body);

    const link = await prisma.shareLink.findUnique({
      where: { id: parsed.linkId },
      include: { document: true },
    });

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    if (link.expiresAt && new Date() > link.expiresAt) {
      return NextResponse.json({ error: "Link expired" }, { status: 410 });
    }

    if (link.passwordHash) {
      const provided = parsed.password ?? "";
      const valid = await bcrypt.compare(provided, link.passwordHash);
      if (!valid) {
        return NextResponse.json(
          { error: "Invalid password" },
          { status: 401 },
        );
      }
    }

    if (link.emailGate && !parsed.viewerEmail) {
      return NextResponse.json({ error: "Email required" }, { status: 401 });
    }

    const token = customAlphabet(
      "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_",
      32,
    )();

    const expiresAt = new Date(Date.now() + GRANT_TTL_MINUTES * 60 * 1000);

    await prisma.viewerGrant.create({
      data: {
        linkId: link.id,
        token,
        expiresAt,
      },
    });

    return NextResponse.json({
      token,
      viewerEmail: parsed.viewerEmail ?? null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 },
      );
    }
    console.error("Viewer verify error:", error);
    return NextResponse.json(
      { error: "Failed to verify access" },
      { status: 500 },
    );
  }
}
