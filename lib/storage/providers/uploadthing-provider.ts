import { UTApi } from "uploadthing/server";
import type { IStorageProvider, PutResult, StorageMetadata } from "../types";

export class UploadThingStorageProvider implements IStorageProvider {
  private utapi = new UTApi();

  async put(buffer: Buffer, metadata: StorageMetadata): Promise<PutResult> {
    const file = new File([buffer as BlobPart], metadata.filename, {
      type: metadata.contentType,
    });
    const response = await this.utapi.uploadFiles(file);

    if (response.error) {
      throw new Error(`UploadThing upload failed: ${response.error.message}`);
    }

    const data = Array.isArray(response.data)
      ? response.data[0]
      : response.data;

    if (!data) {
      throw new Error("UploadThing returned empty upload result");
    }

    return {
      key: data.key,
      url: data.url,
      size: data.size,
      contentType: data.type,
    };
  }

  async getSignedUrl(
    key: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _expiresInSeconds: number,
  ): Promise<string> {
    // UploadThing files are served from a public CDN; signed URLs are not
    // supported in the v0.3 abstraction. The expiresInSeconds parameter is
    // accepted for interface compatibility but ignored.
    return `https://utfs.io/f/${key}`;
  }

  async delete(key: string): Promise<void> {
    await this.utapi.deleteFiles(key);
  }

  async getStream(key: string): Promise<ReadableStream<Uint8Array> | Buffer> {
    const url = `https://utfs.io/f/${key}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch file from UploadThing: ${response.status}`,
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
