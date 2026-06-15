import { UploadThingStorageProvider } from "./providers/uploadthing-provider";
import type { IStorageProvider } from "./types";

export function getStorageProvider(): IStorageProvider {
  const provider = process.env.STORAGE_PROVIDER;

  if (provider === "s3") {
    throw new Error("S3 storage provider is not implemented in v0.3");
  }

  if (provider === "local") {
    throw new Error("Local storage provider is not implemented in v0.3");
  }

  return new UploadThingStorageProvider();
}
