import { prisma } from "./prisma";

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
