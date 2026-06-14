import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ViewerGate } from "@/components/viewer-gate";

interface ViewerPageProps {
  params: { slug: string };
}

export default async function ViewerPage({ params }: ViewerPageProps) {
  const link = await prisma.shareLink.findUnique({
    where: { slug: params.slug },
    include: { document: true },
  });

  if (!link) {
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
