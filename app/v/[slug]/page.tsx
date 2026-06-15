import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ViewerGate } from "@/components/viewer-gate";
import { resolveWorkspaceByHostname } from "@/lib/workspace-domain";

interface ViewerPageProps {
  params: { slug: string };
}

export default async function ViewerPage({ params }: ViewerPageProps) {
  const host = headers().get("host") ?? "";
  const workspace = await resolveWorkspaceByHostname(host);

  const link = await prisma.shareLink.findUnique({
    where: { slug: params.slug },
    include: { document: true },
  });

  if (!link || !link.document) {
    notFound();
  }

  // When served via a custom domain, the link must belong to that workspace.
  if (workspace && link.document.workspaceId !== workspace.id) {
    notFound();
  }

  const isExpired = link.expiresAt ? new Date() > link.expiresAt : false;

  return (
    <ViewerGate
      documentId={link.document.id}
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
