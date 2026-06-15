import { describe, it, expect, vi } from "vitest";
import {
  resolveWorkspaceByHostname,
  getCanonicalOrigin,
} from "@/lib/workspace-domain";

const { findFirstMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspace: {
      findFirst: findFirstMock,
    },
  },
}));

describe("resolveWorkspaceByHostname", () => {
  it("returns null for the canonical app domain", async () => {
    process.env.NEXT_PUBLIC_APP_DOMAIN = "app.example.com";
    const result = await resolveWorkspaceByHostname("app.example.com");
    expect(result).toBeNull();
  });

  it("returns null for localhost", async () => {
    const result = await resolveWorkspaceByHostname("localhost:3000");
    expect(result).toBeNull();
  });

  it("returns null for raw IPs", async () => {
    const result = await resolveWorkspaceByHostname("192.168.1.1");
    expect(result).toBeNull();
  });

  it("resolves a workspace by verified custom domain", async () => {
    delete process.env.NEXT_PUBLIC_APP_DOMAIN;
    findFirstMock.mockResolvedValue({
      id: "ws-1",
      name: "Acme",
      customDomain: "docs.acme.com",
    });

    const result = await resolveWorkspaceByHostname("docs.acme.com");
    expect(result).toEqual({
      id: "ws-1",
      name: "Acme",
      customDomain: "docs.acme.com",
    });
    expect(findFirstMock).toHaveBeenCalledWith({
      where: {
        customDomain: { equals: "docs.acme.com", mode: "insensitive" },
        customDomainVerifiedAt: { not: null },
      },
      select: { id: true, name: true, customDomain: true },
    });
  });

  it("returns null when no workspace matches", async () => {
    findFirstMock.mockResolvedValue(null);
    const result = await resolveWorkspaceByHostname("unknown.example.com");
    expect(result).toBeNull();
  });
});

describe("getCanonicalOrigin", () => {
  it("strips trailing slash from NEXT_PUBLIC_APP_URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com/";
    expect(getCanonicalOrigin()).toBe("https://app.example.com");
  });

  it("returns empty string when NEXT_PUBLIC_APP_URL is missing", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(getCanonicalOrigin()).toBe("");
  });
});
