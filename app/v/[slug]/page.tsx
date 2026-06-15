import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ViewerGate } from "@/components/viewer-gate";
import {
  resolveWorkspaceByHostname,
  verifyDomainDns,
} from "@/lib/workspace-domain";
import { createLogger } from "@/lib/logger";

const log = createLogger("viewer:custom-domain");

interface ViewerPageProps {
  params: { slug: string };
}

export default async function ViewerPage({ params }: ViewerPageProps) {
  const host = headers().get("host") ?? "";
  const workspace = await resolveWorkspaceByHostname(host);

  // Custom domains must still pass DNS re-verification on every access. If the
  // DNS no longer points to this application, treat it as not found so the
  // owner cannot be impersonated after losing control of the domain.
  if (workspace?.customDomain) {
    const dnsCheck = await verifyDomainDns(workspace.customDomain);
    if (!dnsCheck.ok) {
      log.warn(
        { domain: workspace.customDomain, host },
        "custom_domain.dns_reverification_failed",
      );
      notFound();
    }
  }

  const link = await prisma.shareLink.findUnique({
    where: { slug: params.slug },
    include: { document: true },
  });

  if (!link) {
    notFound();
  }

  // When served via a custom domain, the link must belong to that workspace.
  if (workspace && link.document.workspaceId !== workspace.id) {
    notFound();
  }

  const isExpired = link.expiresAt ? new Date() > link.expiresAt : false;

  return (
    <ViewerGate
      link={{
        id: link.id,
        slug: link.slug,
        passwordHash: link.passwordHash,
        emailGate: link.emailGate,
        allowDownload: link.allowDownload,
        isExpired,
      }}
      filename={link.document.filename}
    />
  );
}
