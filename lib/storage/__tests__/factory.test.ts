import { describe, expect, it } from "vitest";
import { getStorageProvider } from "@/lib/storage/factory";
import { UploadThingStorageProvider } from "@/lib/storage/providers/uploadthing-provider";

describe("getStorageProvider", () => {
  it("returns UploadThing provider by default", () => {
    delete process.env.STORAGE_PROVIDER;
    const provider = getStorageProvider();
    expect(provider).toBeInstanceOf(UploadThingStorageProvider);
  });

  it("throws for s3 provider", () => {
    process.env.STORAGE_PROVIDER = "s3";
    expect(() => getStorageProvider()).toThrow(
      "S3 storage provider is not implemented in v0.3",
    );
    delete process.env.STORAGE_PROVIDER;
  });

  it("throws for local provider", () => {
    process.env.STORAGE_PROVIDER = "local";
    expect(() => getStorageProvider()).toThrow(
      "Local storage provider is not implemented in v0.3",
    );
    delete process.env.STORAGE_PROVIDER;
  });
});
