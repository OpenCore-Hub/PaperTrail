import { prisma } from "./prisma";
import { promises as dns } from "dns";

/**
 * Verify that a custom domain's DNS records still point to the expected target.
 * Returns true if the domain resolves to CUSTOM_DOMAIN_CNAME_TARGET (hostname
 * match) or to the configured IP (when target is an IPv4 address).
 */
export async function verifyDomainDns(domain: string): Promise<{
  ok: boolean;
  records: string[];
  instructions: string;
}> {
  const target = process.env.CUSTOM_DOMAIN_CNAME_TARGET;
  const records: string[] = [];

  try {
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
    const cnameMatch = records.some(
      (r) => r.toLowerCase() === target.toLowerCase(),
    );
    if (!cnameMatch) {
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

/**
 * Resolve the workspace that should serve a given hostname.
 * Returns null when the hostname is the canonical app host or unknown.
 */
export async function resolveWorkspaceByHostname(
  hostname: string,
): Promise<{ id: string; name: string; customDomain: string } | null> {
  const canonical = process.env.NEXT_PUBLIC_APP_DOMAIN;

  if (canonical && hostname.toLowerCase() === canonical.toLowerCase()) {
    return null;
  }

  // localhost / IP / no custom domain
  if (
    hostname === "localhost" ||
    hostname.startsWith("localhost:") ||
    /^\d+\.\d+\.\d+\.\d+(:\d+)?$/.test(hostname) ||
    hostname.endsWith(".localhost")
  ) {
    return null;
  }

  const workspace = await prisma.workspace.findFirst({
    where: {
      customDomain: { equals: hostname, mode: "insensitive" },
      customDomainVerifiedAt: { not: null },
    },
    select: { id: true, name: true, customDomain: true },
  });

  if (!workspace?.customDomain) return null;

  return {
    id: workspace.id,
    name: workspace.name,
    customDomain: workspace.customDomain,
  };
}

export function getCanonicalOrigin(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  return "";
}
