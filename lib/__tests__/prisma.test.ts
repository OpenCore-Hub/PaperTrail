import { describe, it, expect } from "vitest";
import { buildDatabaseUrl } from "@/lib/prisma";

describe("buildDatabaseUrl", () => {
  it("returns undefined when no URL is provided", () => {
    expect(buildDatabaseUrl(undefined)).toBeUndefined();
  });

  it("adds default connection_limit and pool_timeout when missing", () => {
    const result = buildDatabaseUrl(
      "postgresql://user:pass@localhost:5432/dochub",
    );
    expect(result).toContain("connection_limit=20");
    expect(result).toContain("pool_timeout=10");
  });

  it("preserves existing query parameters", () => {
    const result = buildDatabaseUrl(
      "postgresql://user:pass@localhost:5432/dochub?connection_limit=50",
    );
    expect(result).toContain("connection_limit=50");
    expect(result).toContain("pool_timeout=10");
    expect(result).not.toContain("connection_limit=20");
  });

  it("does not override explicitly set pool_timeout", () => {
    const result = buildDatabaseUrl(
      "postgresql://user:pass@localhost:5432/dochub?pool_timeout=30",
    );
    expect(result).toContain("connection_limit=20");
    expect(result).toContain("pool_timeout=30");
  });

  it("falls back to the raw URL when it cannot be parsed", () => {
    const raw = "not-a-valid-url";
    expect(buildDatabaseUrl(raw)).toBe(raw);
  });
});
