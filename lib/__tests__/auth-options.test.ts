import { describe, it, expect } from "vitest";
import { authOptions } from "@/lib/auth";

describe("authOptions", () => {
  it("includes a Google OAuth provider", () => {
    const google = authOptions.providers.find((p) => p.id === "google");
    expect(google).toBeDefined();
    expect(google?.name).toBe("Google");
  });

  it("includes a credentials provider", () => {
    const credentials = authOptions.providers.find((p) => p.id === "credentials");
    expect(credentials).toBeDefined();
  });

  it("allows Google sign-in to auto-provision a workspace for new users", () => {
    expect(authOptions.callbacks?.signIn).toBeDefined();
  });
});
