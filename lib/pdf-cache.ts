import fs from "fs/promises";
import path from "path";
import { createLogger } from "./logger";

const log = createLogger("pdf-cache");

export interface PdfCacheOptions {
  cacheDir: string;
  ttlMs: number;
}

function getDefaultCacheDir(): string {
  return process.env.PDF_CACHE_DIR
    ? path.resolve(process.env.PDF_CACHE_DIR)
    : path.join(process.cwd(), ".cache", "pdf");
}

function getDefaultTtlMs(): number {
  const env = process.env.PDF_CACHE_TTL_MS;
  return env ? Number(env) : 60 * 60 * 1000; // 1 hour
}

function cacheEntryPath(cacheDir: string, storageKey: string): string {
  // Use the storage key directly; UploadThing keys are URL-safe.
  return path.join(cacheDir, `${storageKey}.pdf`);
}

function metadataPath(cacheDir: string, storageKey: string): string {
  return path.join(cacheDir, `${storageKey}.json`);
}

interface CacheMetadata {
  cachedAt: string;
  filename: string;
  contentType: string;
  size: number;
}

export class PdfCache {
  private readonly cacheDir: string;
  private readonly ttlMs: number;

  constructor(options?: Partial<PdfCacheOptions>) {
    this.cacheDir = options?.cacheDir ?? getDefaultCacheDir();
    this.ttlMs = options?.ttlMs ?? getDefaultTtlMs();
  }

  async init(): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true });
  }

  private async isValid(storageKey: string): Promise<CacheMetadata | null> {
    const metaFile = metadataPath(this.cacheDir, storageKey);
    const pdfFile = cacheEntryPath(this.cacheDir, storageKey);

    try {
      const [metaStat, pdfStat] = await Promise.all([
        fs.stat(metaFile),
        fs.stat(pdfFile),
      ]);

      const meta: CacheMetadata = JSON.parse(await fs.readFile(metaFile, "utf-8"));
      const now = Date.now();
      const cachedAt = new Date(meta.cachedAt).getTime();

      if (
        now - cachedAt > this.ttlMs ||
        metaStat.mtime.getTime() !== pdfStat.mtime.getTime()
      ) {
        return null;
      }

      return meta;
    } catch {
      return null;
    }
  }

  /**
   * Return a cached PDF as a Buffer if it exists and has not expired.
   */
  async get(storageKey: string): Promise<{
    buffer: Buffer;
    metadata: CacheMetadata;
  } | null> {
    await this.init();

    const meta = await this.isValid(storageKey);
    if (!meta) return null;

    const pdfFile = cacheEntryPath(this.cacheDir, storageKey);
    try {
      const buffer = await fs.readFile(pdfFile);
      log.debug({ storageKey, size: buffer.length }, "pdf.cache_hit");
      return { buffer, metadata: meta };
    } catch (error) {
      log.error({ storageKey, error }, "pdf.cache_read_failed");
      return null;
    }
  }

  /**
   * Store a PDF buffer in the cache.
   */
  async set(
    storageKey: string,
    buffer: Buffer,
    metadata: Omit<CacheMetadata, "cachedAt">,
  ): Promise<void> {
    await this.init();

    const pdfFile = cacheEntryPath(this.cacheDir, storageKey);
    const metaFile = metadataPath(this.cacheDir, storageKey);

    const fullMetadata: CacheMetadata = {
      ...metadata,
      cachedAt: new Date().toISOString(),
    };

    try {
      await fs.writeFile(pdfFile, buffer);
      await fs.writeFile(metaFile, JSON.stringify(fullMetadata, null, 2));
      log.debug({ storageKey, size: buffer.length }, "pdf.cache_stored");
    } catch (error) {
      log.error({ storageKey, error }, "pdf.cache_store_failed");
      // Non-fatal: the caller can still serve the buffer from upstream.
    }
  }

  /**
   * Remove expired cache entries.
   */
  async cleanup(): Promise<{ deleted: number }> {
    await this.init();

    let deleted = 0;
    const now = Date.now();

    try {
      const entries = await fs.readdir(this.cacheDir);
      for (const entry of entries) {
        if (!entry.endsWith(".json")) continue;

        const storageKey = entry.slice(0, -5); // remove .json
        const metaFile = metadataPath(this.cacheDir, storageKey);

        try {
          const raw = await fs.readFile(metaFile, "utf-8");
          const meta: CacheMetadata = JSON.parse(raw);
          const cachedAt = new Date(meta.cachedAt).getTime();

          if (now - cachedAt > this.ttlMs) {
            await fs.unlink(metaFile);
            try {
              await fs.unlink(cacheEntryPath(this.cacheDir, storageKey));
            } catch {
              // PDF may already be gone; metadata is the source of truth.
            }
            deleted++;
          }
        } catch (error) {
          log.error({ storageKey, error }, "pdf.cache_cleanup_entry_failed");
        }
      }
    } catch (error) {
      log.error({ error }, "pdf.cache_cleanup_failed");
    }

    return { deleted };
  }
}

export const pdfCache = new PdfCache();
