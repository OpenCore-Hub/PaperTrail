import fs from "fs";
import { prisma } from "../lib/prisma";
import { SEED_PATH, readSeedState } from "./fixtures/seed";

export default async function globalTeardown(): Promise<void> {
  if (!fs.existsSync(SEED_PATH)) {
    return;
  }

  try {
    const state = readSeedState();

    await prisma.shareLink.deleteMany({
      where: {
        id: {
          in: [
            state.openLinkId,
            state.passwordLinkId,
            state.expiredLinkId,
          ],
        },
      },
    });
    await prisma.document.deleteMany({
      where: { id: state.documentId },
    });
    await prisma.user.deleteMany({
      where: { id: state.userId },
    });
    await prisma.workspace.deleteMany({
      where: { id: state.workspaceId },
    });
  } finally {
    fs.unlinkSync(SEED_PATH);
  }
}
