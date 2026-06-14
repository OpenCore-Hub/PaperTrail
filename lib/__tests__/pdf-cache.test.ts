import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { PdfCache } from "@/lib/pdf-cache";

describe("PdfCache", () => {
  let cacheDir: string;
  let cache: PdfCache;

  beforeEach(async () => {
    cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdf-cache-test-"));
    cache = new PdfCache({ cacheDir, ttlMs: 1000 });
  });

  afterEach(async () => {
    await fs.rm(cacheDir, { recursive: true, force: true });
  });

  it("stores and retrieves a PDF", async () => {
    const buffer = Buffer.from("fake-pdf-content");
    await cache.set("key-1", buffer, {
      filename: "doc.pdf",
      contentType: "application/pdf",
      size: buffer.length,
    });

    const cached = await cache.get("key-1");
    expect(cached).not.toBeNull();
    expect(cached?.buffer.toString()).toBe("fake-pdf-content");
    expect(cached?.metadata.filename).toBe("doc.pdf");
  });

  it("returns null for missing keys", async () => {
    const cached = await cache.get("missing-key");
    expect(cached).toBeNull();
  });

  it("returns null for expired entries", async () => {
    const buffer = Buffer.from("expired");
    await cache.set("key-2", buffer, {
      filename: "doc.pdf",
      contentType: "application/pdf",
      size: buffer.length,
    });

    await new Promise((resolve) => setTimeout(resolve, 1100));

    const cached = await cache.get("key-2");
    expect(cached).toBeNull();
  });

  it("cleans up expired entries", async () => {
    const buffer = Buffer.from("old");
    await cache.set("key-3", buffer, {
      filename: "doc.pdf",
      contentType: "application/pdf",
      size: buffer.length,
    });

    await new Promise((resolve) => setTimeout(resolve, 1100));

    const result = await cache.cleanup();
    expect(result.deleted).toBe(1);

    const cached = await cache.get("key-3");
    expect(cached).toBeNull();
  });
});
