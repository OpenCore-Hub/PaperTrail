import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import { resetRateLimits } from "@/lib/rate-limit";

const {
  userFindUniqueMock,
  workspaceCreateMock,
  userCreateMock,
} = vi.hoisted(() => ({
  userFindUniqueMock: vi.fn(),
  workspaceCreateMock: vi.fn(),
  userCreateMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: userFindUniqueMock,
      create: userCreateMock,
    },
    workspace: {
      create: workspaceCreateMock,
    },
  },
}));

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(body),
  }) as NextRequest;
}

const validBody = {
  name: "Test User",
  workspaceName: "Test Workspace",
  email: "new@example.com",
  password: "password123",
};

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimits();
  });

  it("creates a workspace and user for a new email", async () => {
    userFindUniqueMock.mockResolvedValue(null);
    workspaceCreateMock.mockResolvedValue({ id: "ws-1" });
    userCreateMock.mockResolvedValue({ id: "user-1" });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
    expect(workspaceCreateMock).toHaveBeenCalled();
    expect(userCreateMock).toHaveBeenCalled();
  });

  it("returns 409 when email is already registered", async () => {
    userFindUniqueMock.mockResolvedValue({ id: "existing-user" });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(409);
    expect(workspaceCreateMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid input", async () => {
    const res = await POST(
      makeRequest({ ...validBody, email: "not-an-email" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 429 after exceeding the rate limit", async () => {
    userFindUniqueMock.mockResolvedValue(null);
    workspaceCreateMock.mockResolvedValue({ id: "ws-1" });
    userCreateMock.mockResolvedValue({ id: "user-1" });

    // The auth window allows 10 requests per IP per hour.
    for (let i = 0; i < 10; i++) {
      const res = await POST(makeRequest({ ...validBody, email: `u${i}@example.com` }));
      expect(res.status).toBe(201);
    }

    const blocked = await POST(makeRequest({ ...validBody, email: "blocked@example.com" }));
    expect(blocked.status).toBe(429);
  });
});
