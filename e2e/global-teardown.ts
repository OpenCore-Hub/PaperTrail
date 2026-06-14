import fs from "fs";
import { prisma } from "../lib/prisma";
import { SEED_PATH, readSeedState } from "./fixtures/seed";

export default async function globalTeardown(): Promise<void> {
  if (!fs.existsSync(SEED_PATH)) {
    return;
  }

  try {
    const state = readSeedState();

    // Best-effort cleanup of files uploaded during E2E runs. We delete these
    // from UploadThing so the test bucket does not accumulate orphaned objects.
    // Errors are logged but not thrown; teardown must still delete DB rows.
    const uploadedKeys = state.uploadedStorageKeys ?? [];
    if (uploadedKeys.length > 0) {
      try {
        const { UTApi } = await import("uploadthing/server");
        const utapi = new UTApi();
        await utapi.deleteFiles(uploadedKeys);
        console.log("[e2e:teardown] cleaned up uploaded files:", uploadedKeys);
      } catch (error) {
        console.error(
          "[e2e:teardown] failed to clean up uploaded files:",
          error,
        );
      }
    }

    await prisma.shareLink.deleteMany({
      where: {
        id: {
          in: [state.openLinkId, state.passwordLinkId, state.expiredLinkId],
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
