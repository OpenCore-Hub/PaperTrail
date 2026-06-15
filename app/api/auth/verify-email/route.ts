import { NextRequest, NextResponse } from "next/server";
import { customAlphabet } from "nanoid";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import { enforceRateLimit, RateLimits } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { z } from "zod";

const log = createLogger("api:auth:verify-email");

export const dynamic = "force-dynamic";

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

const resendSchema = z.object({
  email: z.string().email(),
});

function absoluteUrl(req: NextRequest, path: string): string {
  const base = process.env.NEXTAUTH_URL ?? req.nextUrl.origin;
  return `${base}${path}`;
}

/**
 * GET /api/auth/verify-email?token=<token>
 *
 * Validates an email verification token and marks the user as verified.
 * This is the endpoint clicked from verification emails, so it redirects
 * rather than returning JSON.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      absoluteUrl(req, "/auth/verify-email?error=missing"),
    );
  }

  try {
    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken || verificationToken.expiresAt < new Date()) {
      return NextResponse.redirect(
        absoluteUrl(req, "/auth/verify-email?error=invalid"),
      );
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { email: verificationToken.email },
        data: { emailVerified: new Date() },
      }),
      prisma.emailVerificationToken.delete({
        where: { id: verificationToken.id },
      }),
    ]);

    log.info(
      { email: verificationToken.email },
      "auth.email_verification_completed",
    );

    return NextResponse.redirect(
      absoluteUrl(req, "/auth/signin?verified=1"),
    );
  } catch (error) {
    log.error({ error }, "auth.email_verification_failed");
    return NextResponse.redirect(
      absoluteUrl(req, "/auth/verify-email?error=invalid"),
    );
  }
}

/**
 * POST /api/auth/verify-email
 *
 * Resends a verification email for an unverified account. Always returns the
 * same response to avoid leaking whether an email is registered.
 */
export async function POST(req: NextRequest) {
  const rateLimit = await enforceRateLimit(
    req,
    "auth:verify-email:resend",
    RateLimits.auth,
  );
  if (!rateLimit.allowed) {
    return rateLimit.response!;
  }

  try {
    const body = await req.json();
    const parsed = resendSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email: parsed.email },
    });

    if (!user || user.emailVerified || !user.password) {
      return NextResponse.json(
        { message: "If the account exists and is unverified, a new email has been sent." },
        { status: 200 },
      );
    }

    await prisma.emailVerificationToken.deleteMany({
      where: { email: user.email },
    });

    const token = customAlphabet(
      "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_",
      32,
    )();
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);

    await prisma.emailVerificationToken.create({
      data: {
        email: user.email,
        token,
        expiresAt,
      },
    });

    const verifyUrl = `${process.env.NEXTAUTH_URL ?? ""}/auth/verify-email?token=${token}`;

    await sendVerificationEmail({
      to: user.email,
      verifyUrl,
    });

    return NextResponse.json(
      { message: "If the account exists and is unverified, a new email has been sent." },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 },
      );
    }
    log.error({ error }, "auth.verify_email_resend_failed");
    return NextResponse.json(
      { error: "Failed to resend verification email" },
      { status: 500 },
    );
  }
}
