import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getRequestLogger } from "@/lib/logger";
import { audit } from "@/lib/audit";
import { withRequestContext } from "@/lib/with-request-context";
import { enforceRateLimit, RateLimits } from "@/lib/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

async function handler(req: NextRequest) {
  const log = getRequestLogger("api:auth:reset-password");

  const rateLimit = await enforceRateLimit(
    req,
    "auth:reset-password",
    RateLimits.auth,
  );
  if (!rateLimit.allowed) {
    return rateLimit.response!;
  }

  try {
    const body = await req.json();
    const parsed = resetSchema.parse(body);

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token: parsed.token },
    });

    if (!resetToken || resetToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(parsed.password, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { email: resetToken.email },
        data: {
          password: passwordHash,
          sessionVersion: { increment: 1 },
        },
      }),
      prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      }),
    ]);

    audit("auth.password_reset_completed", { email: resetToken.email });

    return NextResponse.json(
      { message: "Password updated successfully" },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 },
      );
    }
    log.error({ error }, "auth.reset_password_failed");
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 },
    );
  }
}

export const POST = withRequestContext(handler);
