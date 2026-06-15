import { describe, expect, it, vi } from "vitest";
import { UploadThingStorageProvider } from "@/lib/storage/providers/uploadthing-provider";

const deleteFilesMock = vi.fn();
const uploadFilesMock = vi.fn();

vi.mock("uploadthing/server", () => ({
  UTApi: vi.fn().mockImplementation(function MockUTApi() {
    return {
      uploadFiles: uploadFilesMock,
      deleteFiles: deleteFilesMock,
    };
  }),
}));

describe("UploadThingStorageProvider", () => {
  const metadata = {
    contentType: "application/pdf",
    filename: "test.pdf",
    workspaceId: "ws-1",
    uploaderId: "user-1",
  };

  it("uploads a buffer and returns PutResult", async () => {
    uploadFilesMock.mockResolvedValueOnce({
      data: {
        key: "key-1",
        url: "https://utfs.io/f/key-1",
        size: 1024,
        type: "application/pdf",
      },
      error: null,
    });

    const provider = new UploadThingStorageProvider();
    const result = await provider.put(Buffer.from("pdf"), metadata);

    expect(result).toEqual({
      key: "key-1",
      url: "https://utfs.io/f/key-1",
      size: 1024,
      contentType: "application/pdf",
    });
  });

  it("uploads an array response and returns PutResult", async () => {
    uploadFilesMock.mockResolvedValueOnce({
      data: [
        {
          key: "key-2",
          url: "https://utfs.io/f/key-2",
          size: 2048,
          type: "application/pdf",
        },
      ],
      error: null,
    });

    const provider = new UploadThingStorageProvider();
    const result = await provider.put(Buffer.from("pdf"), metadata);

    expect(result.key).toBe("key-2");
    expect(result.size).toBe(2048);
  });

  it("throws when UploadThing returns an error", async () => {
    uploadFilesMock.mockResolvedValueOnce({
      data: null,
      error: { message: "upload failed" },
    });

    const provider = new UploadThingStorageProvider();
    await expect(provider.put(Buffer.from("pdf"), metadata)).rejects.toThrow(
      "upload failed",
    );
  });

  it("throws when UploadThing returns empty data", async () => {
    uploadFilesMock.mockResolvedValueOnce({ data: null, error: null });

    const provider = new UploadThingStorageProvider();
    await expect(provider.put(Buffer.from("pdf"), metadata)).rejects.toThrow(
      "empty upload result",
    );
  });

  it("returns a public CDN URL as signed URL", async () => {
    const provider = new UploadThingStorageProvider();
    const url = await provider.getSignedUrl("key-1", 3600);
    expect(url).toBe("https://utfs.io/f/key-1");
  });

  it("deletes a file by key", async () => {
    deleteFilesMock.mockResolvedValueOnce(undefined);

    const provider = new UploadThingStorageProvider();
    await provider.delete("key-1");
    expect(deleteFilesMock).toHaveBeenCalledWith("key-1");
  });

  it("fetches a file as a Buffer", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => Buffer.from("file-content"),
    });

    const provider = new UploadThingStorageProvider();
    const result = await provider.getStream("key-1");

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.toString()).toBe("file-content");
  });

  it("throws when fetch fails", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const provider = new UploadThingStorageProvider();
    await expect(provider.getStream("key-1")).rejects.toThrow("404");
  });
});
