import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { seedConstants, writeSeedState, type SeedState } from "./fixtures/seed";

export default async function globalSetup(): Promise<void> {
  console.log("[e2e:setup] seeding test data...");
  const passwordHash = await bcrypt.hash(seedConstants.adminPassword, 10);
  const linkPasswordHash = await bcrypt.hash(seedConstants.passwordPlain, 10);

  // Clean up any previous seed data first to avoid unique-constraint failures
  // when re-running tests locally.
  await prisma.shareLink.deleteMany({
    where: {
      slug: {
        in: [
          seedConstants.openSlug,
          seedConstants.passwordSlug,
          seedConstants.expiredSlug,
        ],
      },
    },
  });
  await prisma.document.deleteMany({
    where: { storageKey: seedConstants.storageKey },
  });
  await prisma.user.deleteMany({
    where: { email: seedConstants.adminEmail },
  });
  await prisma.workspace.deleteMany({
    where: { slug: seedConstants.workspaceSlug },
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: seedConstants.workspaceName,
      slug: seedConstants.workspaceSlug,
    },
  });

  const user = await prisma.user.create({
    data: {
      email: seedConstants.adminEmail,
      name: "E2E Admin",
      password: passwordHash,
      role: "ADMIN",
      workspaceId: workspace.id,
    },
  });

  const document = await prisma.document.create({
    data: {
      workspaceId: workspace.id,
      uploadedBy: user.id,
      filename: seedConstants.documentFilename,
      storageKey: seedConstants.storageKey,
      fileSize: 1024,
    },
  });

  const [openLink, passwordLink, expiredLink] = await prisma.$transaction([
    prisma.shareLink.create({
      data: {
        documentId: document.id,
        slug: seedConstants.openSlug,
        emailGate: false,
        allowDownload: false,
      },
    }),
    prisma.shareLink.create({
      data: {
        documentId: document.id,
        slug: seedConstants.passwordSlug,
        passwordHash: linkPasswordHash,
        emailGate: false,
        allowDownload: false,
      },
    }),
    prisma.shareLink.create({
      data: {
        documentId: document.id,
        slug: seedConstants.expiredSlug,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        emailGate: false,
        allowDownload: false,
      },
    }),
  ]);

  const state: SeedState = {
    workspaceId: workspace.id,
    userId: user.id,
    documentId: document.id,
    openLinkId: openLink.id,
    passwordLinkId: passwordLink.id,
    expiredLinkId: expiredLink.id,
    uploadedStorageKeys: [],
  };

  writeSeedState(state);
  console.log("[e2e:setup] seeded user", user.id, "workspace", workspace.id);
}
