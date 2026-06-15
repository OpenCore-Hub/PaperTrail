import { describe, it, expect, beforeEach } from "vitest";
import { isAllowed, resetRateLimits } from "@/lib/rate-limit";

describe("isAllowed", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("allows requests up to the limit", async () => {
    const window = { maxRequests: 3, windowMs: 60_000 };
    expect(await isAllowed("key", window)).toBe(true);
    expect(await isAllowed("key", window)).toBe(true);
    expect(await isAllowed("key", window)).toBe(true);
    expect(await isAllowed("key", window)).toBe(false);
  });

  it("resets the window after it expires", async () => {
    const window = { maxRequests: 1, windowMs: 1 };
    expect(await isAllowed("key", window)).toBe(true);
    expect(await isAllowed("key", window)).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(await isAllowed("key", window)).toBe(true);
  });

  it("tracks different keys independently", async () => {
    const window = { maxRequests: 1, windowMs: 60_000 };
    expect(await isAllowed("a", window)).toBe(true);
    expect(await isAllowed("b", window)).toBe(true);
  });
});
