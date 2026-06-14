import { describe, it, expect, beforeEach } from "vitest";
import { isAllowed, resetRateLimits } from "@/lib/rate-limit";

describe("isAllowed", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("allows requests up to the limit", () => {
    const window = { maxRequests: 3, windowMs: 60_000 };
    expect(isAllowed("key", window)).toBe(true);
    expect(isAllowed("key", window)).toBe(true);
    expect(isAllowed("key", window)).toBe(true);
    expect(isAllowed("key", window)).toBe(false);
  });

  it("resets the window after it expires", () => {
    const window = { maxRequests: 1, windowMs: 1 };
    expect(isAllowed("key", window)).toBe(true);
    expect(isAllowed("key", window)).toBe(false);

    // Wait for the window to expire.
    return new Promise((resolve) => {
      setTimeout(() => {
        expect(isAllowed("key", window)).toBe(true);
        resolve(undefined);
      }, 10);
    });
  });

  it("tracks different keys independently", () => {
    const window = { maxRequests: 1, windowMs: 60_000 };
    expect(isAllowed("a", window)).toBe(true);
    expect(isAllowed("b", window)).toBe(true);
  });
});
