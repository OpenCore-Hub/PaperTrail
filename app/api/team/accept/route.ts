import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { teamInviteCounter, withMetrics } from "@/lib/metrics";
import { z } from "zod";

export const dynamic = "force-dynamic";

const acceptSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1),
  password: z.string().min(8),
});

async function handler(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = acceptSchema.parse(body);

    const invite = await prisma.workspaceInvite.findUnique({
      where: { token: parsed.token },
      include: { workspace: true },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Invite has expired" },
        { status: 410 },
      );
    }

    if (invite.acceptedAt) {
      return NextResponse.json(
        { error: "Invite already used" },
        { status: 409 },
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: invite.email },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(parsed.password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: invite.email,
          name: parsed.name,
          password: passwordHash,
          role: invite.role,
          workspaceId: invite.workspaceId,
        },
      });

      await tx.workspaceInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      return created;
    });

    teamInviteCounter.inc({ operation: "accepted" });

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          workspaceId: user.workspaceId,
          role: user.role,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 },
      );
    }
    console.error("Invite accept error:", error);
    return NextResponse.json(
      { error: "Failed to accept invite" },
      { status: 500 },
    );
  }
}

export const POST = withMetrics("/api/team/accept", handler);
