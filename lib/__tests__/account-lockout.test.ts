import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isLoginAllowed,
  recordFailedLogin,
  clearFailedLogins,
} from "@/lib/account-lockout";

describe("account lockout (memory fallback)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    delete process.env.REDIS_URL;
    void clearFailedLogins("user@example.com");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows login when there are no failed attempts", async () => {
    const status = await isLoginAllowed("user@example.com");
    expect(status.allowed).toBe(true);
  });

  it("locks the account after 5 failed attempts", async () => {
    for (let i = 0; i < 4; i++) {
      await recordFailedLogin("user@example.com");
      const status = await isLoginAllowed("user@example.com");
      expect(status.allowed).toBe(true);
    }

    await recordFailedLogin("user@example.com");
    const status = await isLoginAllowed("user@example.com");
    expect(status.allowed).toBe(false);
    expect(status.lockedUntil).toBeGreaterThan(Date.now());
  });

  it("clears failures and lock on successful login", async () => {
    for (let i = 0; i < 5; i++) {
      await recordFailedLogin("user@example.com");
    }

    let status = await isLoginAllowed("user@example.com");
    expect(status.allowed).toBe(false);

    await clearFailedLogins("user@example.com");
    status = await isLoginAllowed("user@example.com");
    expect(status.allowed).toBe(true);
  });

  it("resets the failure window after it expires", async () => {
    await recordFailedLogin("user@example.com");
    vi.advanceTimersByTime(16 * 60 * 1000); // past the 15-minute window

    const status = await isLoginAllowed("user@example.com");
    expect(status.allowed).toBe(true);
  });
});
