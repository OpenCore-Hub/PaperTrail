import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { promises as dns } from "dns";

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

async function verifyDomainDns(domain: string): Promise<{
  ok: boolean;
  records: string[];
  instructions: string;
}> {
  const target = process.env.CUSTOM_DOMAIN_CNAME_TARGET;
  const records: string[] = [];

  try {
    // Try CNAME first
    const cnameRecords = await dns.resolveCname(domain);
    records.push(...cnameRecords);
  } catch {
    // no CNAME
  }

  if (records.length === 0) {
    try {
      const aRecords = await dns.resolve4(domain);
      records.push(...aRecords);
    } catch {
      // no A record
    }
    try {
      const aaaaRecords = await dns.resolve6(domain);
      records.push(...aaaaRecords);
    } catch {
      // no AAAA record
    }
  }

  let ok = records.length > 0;
  let instructions = target
    ? `Add a CNAME record for ${domain} pointing to ${target}, or an A record pointing to your server IP.`
    : `Add a CNAME or A record for ${domain} so it resolves to this application.`;

  if (ok && target && records.length > 0) {
    // CNAME target may be a hostname; A records won't match a hostname target.
    const cnameMatch = records.some(
      (r) => r.toLowerCase() === target.toLowerCase(),
    );
    if (!cnameMatch) {
      // If target looks like an IP, allow A/AAAA match.
      const ipMatch =
        /^\d+\.\d+\.\d+\.\d+$/.test(target) &&
        records.some((r) => r === target);
      ok = ipMatch;
    }
    instructions = `Expected DNS record: ${target}. Current records: ${records.join(
      ", ",
    )}.`;
  }

  if (!ok) {
    instructions += ` We could not resolve any DNS records for ${domain}.`;
  }

  return { ok, records, instructions };
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
    return NextResponse.json(
      { error: "Workspace not found" },
      { status: 404 },
    );
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
    console.error("Domain update error:", error);
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
