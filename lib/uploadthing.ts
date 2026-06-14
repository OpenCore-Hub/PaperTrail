import { createUploadthing, type FileRouter } from "uploadthing/next";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { prisma } from "./prisma";
import { canManageDocuments, type UserRole } from "./roles";

const f = createUploadthing();

interface UploadSession {
  user?: {
    id?: string;
    workspaceId?: string;
    role?: string;
  };
}

export function authorizePdfUpload(session: UploadSession | null): {
  userId: string;
  workspaceId: string;
} {
  if (
    !session?.user?.id ||
    !session?.user?.workspaceId ||
    !canManageDocuments(session.user.role as UserRole)
  ) {
    throw new Error("Unauthorized");
  }
  return {
    userId: session.user.id,
    workspaceId: session.user.workspaceId,
  };
}

export const ourFileRouter = {
  pdfUploader: f({ pdf: { maxFileSize: "32MB" } })
    .middleware(async () => {
      const session = await getServerSession(authOptions);
      return authorizePdfUpload(session);
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const MAX_APP_SIZE_BYTES = 20 * 1024 * 1024;
      if (file.size > MAX_APP_SIZE_BYTES) {
        // UploadThing accepts up to 32MB, but the product contract is 20MB.
        // Best-effort cleanup: delete the oversized file and skip metadata.
        try {
          const { UTApi } = await import("uploadthing/server");
          const utapi = new UTApi();
          await utapi.deleteFiles(file.key);
        } catch (e) {
          console.error("Failed to delete oversized upload", e);
        }
        throw new Error("File exceeds 20MB app limit");
      }

      await prisma.document.create({
        data: {
          workspaceId: metadata.workspaceId,
          uploadedBy: metadata.userId,
          filename: file.name,
          storageKey: file.key,
          fileSize: file.size,
        },
      });
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
