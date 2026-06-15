import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, PUT } from "../route";

vi.stubEnv("NEXTAUTH_SECRET", "test-secret-for-ai-crypto-32bytes");

const {
  getServerSessionMock,
  aiProviderConfigFindUniqueMock,
  aiProviderConfigUpsertMock,
} = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  aiProviderConfigFindUniqueMock: vi.fn(),
  aiProviderConfigUpsertMock: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiProviderConfig: {
      findUnique: aiProviderConfigFindUniqueMock,
      upsert: aiProviderConfigUpsertMock,
    },
  },
}));

function mockSession(role: "ADMIN" | "EDITOR" = "ADMIN") {
  getServerSessionMock.mockResolvedValue({
    user: { id: "user-1", workspaceId: "ws-1", role },
  });
}

function makePutRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/workspaces/ai-config", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

describe("GET /api/workspaces/ai-config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns default config when none exists", async () => {
    mockSession();
    aiProviderConfigFindUniqueMock.mockResolvedValue(null);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.mode).toBe("CLOUD");
    expect(json.provider).toBe("openai");
  });

  it("returns 401 for unauthenticated users", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/workspaces/ai-config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves BYOK config and masks apiKey", async () => {
    mockSession();
    aiProviderConfigUpsertMock.mockResolvedValue({
      id: "cfg-1",
      workspaceId: "ws-1",
      mode: "BYOK",
      provider: "openai",
      model: "gpt-4o",
      apiKey: "encrypted",
      baseUrl: null,
    });

    const res = await PUT(
      makePutRequest({
        mode: "BYOK",
        provider: "openai",
        model: "gpt-4o",
        apiKey: "sk-secret",
      }),
    );

    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.mode).toBe("BYOK");
    expect(json.apiKey).toBe("***");
  });

  it("rejects non-admin users", async () => {
    mockSession("EDITOR");
    const res = await PUT(
      makePutRequest({
        mode: "CLOUD",
        provider: "openai",
        model: "gpt-4o-mini",
      }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects invalid input", async () => {
    mockSession();
    const res = await PUT(
      makePutRequest({
        mode: "INVALID",
        provider: "openai",
        model: "gpt-4o",
      }),
    );
    expect(res.status).toBe(400);
  });
});
