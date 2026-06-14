import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { customAlphabet } from "nanoid";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendInviteEmail } from "@/lib/email";
import { z } from "zod";

export const dynamic = "force-dynamic";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "EDITOR"]).default("EDITOR"),
});

// 7-day invite token
const INVITE_TTL_DAYS = 7;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.workspaceId || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = inviteSchema.parse(body);

    const workspaceId = session.user.workspaceId;

    const existingUser = await prisma.user.findUnique({
      where: { email: parsed.email },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "User already belongs to a workspace" },
        { status: 409 },
      );
    }

    const existingInvite = await prisma.workspaceInvite.findUnique({
      where: { workspaceId_email: { workspaceId, email: parsed.email } },
    });

    if (existingInvite && existingInvite.expiresAt > new Date()) {
      return NextResponse.json(
        { error: "Pending invite already exists for this email" },
        { status: 409 },
      );
    }

    const token = customAlphabet(
      "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_",
      32,
    )();
    const expiresAt = new Date(
      Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    const invite = await prisma.workspaceInvite.upsert({
      where: { workspaceId_email: { workspaceId, email: parsed.email } },
      update: {
        role: parsed.role,
        token,
        expiresAt,
        acceptedAt: null,
      },
      create: {
        workspaceId,
        email: parsed.email,
        role: parsed.role,
        token,
        expiresAt,
      },
    });

    const inviteUrl = `${process.env.NEXTAUTH_URL ?? ""}/auth/invite?token=${invite.token}`;

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });

    const emailResult = await sendInviteEmail({
      to: parsed.email,
      workspaceName: workspace?.name ?? "DocHub",
      inviteUrl,
      invitedByName: session.user.name,
    });

    return NextResponse.json(
      {
        invite: {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          token: invite.token,
          expiresAt: invite.expiresAt,
          inviteUrl,
        },
        emailSent: emailResult.ok,
        emailProvider: emailResult.provider,
        emailDetail: emailResult.detail,
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
    console.error("Invite creation error:", error);
    return NextResponse.json(
      { error: "Failed to create invite" },
      { status: 500 },
    );
  }
}
