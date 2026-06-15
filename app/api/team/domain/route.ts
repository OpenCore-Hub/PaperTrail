import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { enforceRateLimit, RateLimits } from "@/lib/rate-limit";
import { verifyDomainDns } from "@/lib/workspace-domain";
import { z } from "zod";

const log = createLogger("api:team:domain");

export const dynamic = "force-dynamic";

const domainSchema = z.object({
  domain: z
    .string()
    .min(1)
    .transform((d) => d.trim().toLowerCase()),
});

function normalizeDomain(domain: string): string {
  let d = domain.trim().toLowerCase();
  if (d.startsWith("http://") || d.startsWith("https://")) {
    try {
      d = new URL(d).hostname;
    } catch {
      // fall through
    }
  }
  return d.replace(/^www\./, "");
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.workspaceId || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: session.user.workspaceId },
    select: {
      id: true,
      customDomain: true,
      customDomainVerifiedAt: true,
    },
  });

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  return NextResponse.json({
    domain: workspace.customDomain,
    verifiedAt: workspace.customDomainVerifiedAt,
    verified: workspace.customDomainVerifiedAt !== null,
    instructions: process.env.CUSTOM_DOMAIN_CNAME_TARGET
      ? `Add a CNAME record for your domain pointing to ${process.env.CUSTOM_DOMAIN_CNAME_TARGET}.`
      : undefined,
  });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.workspaceId || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await enforceRateLimit(
      req,
      "team:domain:update",
      RateLimits.documentMutation,
      session.user.id,
    );
    if (!rateLimit.allowed) {
      return rateLimit.response!;
    }

    const body = await req.json();
    const parsed = domainSchema.parse(body);
    const domain = normalizeDomain(parsed.domain);

    if (!domain.includes(".")) {
      return NextResponse.json(
        { error: "Please enter a valid domain" },
        { status: 400 },
      );
    }

    const { ok, instructions } = await verifyDomainDns(domain);

    if (!ok) {
      return NextResponse.json(
        { error: "Domain verification failed", instructions },
        { status: 422 },
      );
    }

    // Ensure no other workspace already uses this verified domain.
    const existing = await prisma.workspace.findFirst({
      where: {
        customDomain: { equals: domain, mode: "insensitive" },
        id: { not: session.user.workspaceId },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Domain is already in use by another workspace" },
        { status: 409 },
      );
    }

    const updated = await prisma.workspace.update({
      where: { id: session.user.workspaceId },
      data: {
        customDomain: domain,
        customDomainVerifiedAt: new Date(),
      },
      select: {
        id: true,
        customDomain: true,
        customDomainVerifiedAt: true,
      },
    });

    return NextResponse.json({
      domain: updated.customDomain,
      verifiedAt: updated.customDomainVerifiedAt,
      verified: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 },
      );
    }
    log.error({ error }, "team.domain_update_failed");
    return NextResponse.json(
      { error: "Failed to update domain" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.workspaceId || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.workspace.update({
    where: { id: session.user.workspaceId },
    data: { customDomain: null, customDomainVerifiedAt: null },
  });

  return NextResponse.json({ success: true });
}
