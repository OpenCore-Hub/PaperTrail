import { describe, it, expect, vi } from "vitest";
import { encryptApiKey, decryptApiKey } from "../crypto";

vi.stubEnv("NEXTAUTH_SECRET", "test-secret-for-ai-crypto-32bytes");

describe("ai crypto", () => {
  it("round-trips an API key", () => {
    const key = "sk-test-12345";
    const encrypted = encryptApiKey(key);
    expect(encrypted).not.toBe(key);
    expect(decryptApiKey(encrypted)).toBe(key);
  });

  it("produces different ciphertexts for the same plaintext", () => {
    const key = "sk-test-12345";
    const a = encryptApiKey(key);
    const b = encryptApiKey(key);
    expect(a).not.toBe(b);
  });

  it("throws on invalid ciphertext", () => {
    expect(() => decryptApiKey("not-valid")).toThrow();
  });
});
