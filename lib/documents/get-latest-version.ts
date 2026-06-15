import { prisma } from "@/lib/prisma";

export async function getLatestVersion(documentId: string) {
  return prisma.documentVersion.findFirst({
    where: { documentId },
    orderBy: { versionNumber: "desc" },
  });
}

export async function getLatestVersionOrThrow(documentId: string) {
  const version = await getLatestVersion(documentId);
  if (!version) {
    throw new Error(`No document version found for document ${documentId}`);
  }
  return version;
}
