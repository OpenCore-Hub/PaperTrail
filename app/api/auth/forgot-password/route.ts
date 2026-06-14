import { NextRequest, NextResponse } from "next/server";
import { customAlphabet } from "nanoid";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { createLogger } from "@/lib/logger";
import { z } from "zod";

const log = createLogger("api:auth:forgot-password");

export const dynamic = "force-dynamic";

const forgotSchema = z.object({
  email: z.string().email(),
});

// 1-hour reset token
const RESET_TTL_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = forgotSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email: parsed.email },
    });

    // Always return the same response so we don't leak whether the email exists.
    if (!user || !user.password) {
      return NextResponse.json(
        { message: "If an account exists, a reset email has been sent." },
        { status: 200 },
      );
    }

    const token = customAlphabet(
      "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_",
      32,
    )();
    const expiresAt = new Date(Date.now() + RESET_TTL_MS);

    await prisma.passwordResetToken.create({
      data: {
        email: user.email,
        token,
        expiresAt,
      },
    });

    const resetUrl = `${process.env.NEXTAUTH_URL ?? ""}/auth/reset-password?token=${token}`;

    await sendPasswordResetEmail({
      to: user.email,
      resetUrl,
    });

    return NextResponse.json(
      { message: "If an account exists, a reset email has been sent." },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 },
      );
    }
    log.error({ error }, "auth.forgot_password_failed");
    return NextResponse.json(
      { error: "Failed to send reset email" },
      { status: 500 },
    );
  }
}
