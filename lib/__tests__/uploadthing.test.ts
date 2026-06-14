import { describe, it, expect } from "vitest";
import { authorizePdfUpload } from "@/lib/uploadthing";

describe("authorizePdfUpload", () => {
  it("returns metadata for ADMIN", () => {
    const result = authorizePdfUpload({
      user: { id: "user-1", workspaceId: "ws-1", role: "ADMIN" },
    });
    expect(result).toEqual({ userId: "user-1", workspaceId: "ws-1" });
  });

  it("returns metadata for EDITOR", () => {
    const result = authorizePdfUpload({
      user: { id: "user-1", workspaceId: "ws-1", role: "EDITOR" },
    });
    expect(result).toEqual({ userId: "user-1", workspaceId: "ws-1" });
  });

  it("rejects VIEWER role", () => {
    expect(() =>
      authorizePdfUpload({
        user: { id: "user-1", workspaceId: "ws-1", role: "VIEWER" },
      }),
    ).toThrow("Unauthorized");
  });

  it("rejects unauthenticated session", () => {
    expect(() => authorizePdfUpload(null)).toThrow("Unauthorized");
  });

  it("rejects missing workspaceId", () => {
    expect(() =>
      authorizePdfUpload({
        user: { id: "user-1", workspaceId: undefined, role: "ADMIN" },
      }),
    ).toThrow("Unauthorized");
  });

  it("rejects missing user id", () => {
    expect(() =>
      authorizePdfUpload({
        user: { id: undefined, workspaceId: "ws-1", role: "ADMIN" },
      }),
    ).toThrow("Unauthorized");
  });
});
