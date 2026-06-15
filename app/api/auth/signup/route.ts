import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { customAlphabet } from "nanoid";
import { prisma } from "@/lib/prisma";
import { generateWorkspaceSlug } from "@/lib/slug";
import { enforceRateLimit, RateLimits } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/lib/email";
import { verifyHcaptchaToken } from "@/lib/hcaptcha";
import { getRequestLogger } from "@/lib/logger";
import { audit } from "@/lib/audit";
import { withRequestContext } from "@/lib/with-request-context";
import { z } from "zod";

export const dynamic = "force-dynamic";

const signupSchema = z.object({
  name: z.string().min(1),
  workspaceName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  captchaToken: z.string().min(1),
});

// 24-hour verification token
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

async function handler(req: NextRequest) {
  const log = getRequestLogger("api:auth:signup");

  const rateLimit = await enforceRateLimit(req, "auth:signup", RateLimits.auth);
  if (!rateLimit.allowed) {
    return rateLimit.response!;
  }

  try {
    const body = await req.json();
    const parsed = signupSchema.parse(body);

    const captchaValid = await verifyHcaptchaToken(parsed.captchaToken);
    if (!captchaValid) {
      return NextResponse.json(
        { error: "Captcha verification failed" },
        { status: 400 },
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email: parsed.email },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 },
      );
    }

    const slug = generateWorkspaceSlug(parsed.workspaceName);
    const passwordHash = await bcrypt.hash(parsed.password, 10);

    const workspace = await prisma.workspace.create({
      data: {
        name: parsed.workspaceName,
        slug,
      },
    });

    await prisma.user.create({
      data: {
        email: parsed.email,
        name: parsed.name,
        password: passwordHash,
        role: "ADMIN",
        workspaceId: workspace.id,
      },
    });

    const token = customAlphabet(
      "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_",
      32,
    )();
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);

    await prisma.emailVerificationToken.create({
      data: {
        email: parsed.email,
        token,
        expiresAt,
      },
    });

    const verifyUrl = `${process.env.NEXTAUTH_URL ?? ""}/auth/verify-email?token=${token}`;
    const sendResult = await sendVerificationEmail({
      to: parsed.email,
      verifyUrl,
    });

    if (!sendResult.ok) {
      // Roll back the created workspace/user so the signup can be retried once
      // the email provider is healthy.
      await prisma.workspace.delete({ where: { id: workspace.id } });
      log.error(
        { email: parsed.email, detail: sendResult.detail },
        "auth.signup_verification_email_failed",
      );
      return NextResponse.json(
        { error: "Failed to send verification email. Please try again later." },
        { status: 500 },
      );
    }

    audit("auth.signup", { email: parsed.email, workspaceSlug: slug });

    return NextResponse.json(
      {
        success: true,
        message: "Please check your email to verify your account.",
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
    log.error({ error }, "auth.signup_failed");
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 },
    );
  }
}

export const POST = withRequestContext(handler);
