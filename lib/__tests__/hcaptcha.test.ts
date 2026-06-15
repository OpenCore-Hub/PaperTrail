import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyHcaptchaToken } from "@/lib/hcaptcha";

describe("verifyHcaptchaToken", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubEnv("HCAPTCHA_SECRET", "test-secret");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns true when hCaptcha confirms success", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    const result = await verifyHcaptchaToken("token-123");
    expect(result).toBe(true);
  });

  it("returns false when hCaptcha rejects the token", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, "error-codes": ["invalid-input-response"] }),
    } as Response);

    const result = await verifyHcaptchaToken("bad-token");
    expect(result).toBe(false);
  });

  it("returns false when the verify request fails", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const result = await verifyHcaptchaToken("token-123");
    expect(result).toBe(false);
  });

  it("returns false in production when the secret is missing", async () => {
    vi.stubEnv("HCAPTCHA_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");

    const result = await verifyHcaptchaToken("token-123");
    expect(result).toBe(false);
  });

  it("returns true in development when the secret is missing", async () => {
    vi.stubEnv("HCAPTCHA_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");

    const result = await verifyHcaptchaToken("token-123");
    expect(result).toBe(true);
  });
});
