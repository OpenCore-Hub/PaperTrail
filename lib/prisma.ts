import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const DEFAULT_CONNECTION_LIMIT = "20";
const DEFAULT_POOL_TIMEOUT = "10";

export function buildDatabaseUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;

  try {
    const url = new URL(rawUrl);
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", DEFAULT_CONNECTION_LIMIT);
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", DEFAULT_POOL_TIMEOUT);
    }
    return url.toString();
  } catch {
    // If the URL is malformed, fall back to the raw value and let Prisma
    // surface the real configuration error.
    return rawUrl;
  }
}

const prismaClientSingleton = () => {
  const tunedUrl = buildDatabaseUrl(process.env.DATABASE_URL);
  if (tunedUrl) {
    return new PrismaClient({
      datasources: {
        db: {
          url: tunedUrl,
        },
      },
    });
  }
  return new PrismaClient();
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
