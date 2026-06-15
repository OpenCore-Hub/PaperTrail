import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import { resetRateLimits } from "@/lib/rate-limit";

const {
  userFindUniqueMock,
  workspaceCreateMock,
  userCreateMock,
  workspaceDeleteMock,
  emailVerificationTokenCreateMock,
  sendVerificationEmailMock,
} = vi.hoisted(() => ({
  userFindUniqueMock: vi.fn(),
  workspaceCreateMock: vi.fn(),
  userCreateMock: vi.fn(),
  workspaceDeleteMock: vi.fn(),
  emailVerificationTokenCreateMock: vi.fn(),
  sendVerificationEmailMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: userFindUniqueMock,
      create: userCreateMock,
    },
    workspace: {
      create: workspaceCreateMock,
      delete: workspaceDeleteMock,
    },
    emailVerificationToken: {
      create: emailVerificationTokenCreateMock,
    },
  },
}));

vi.mock("@/lib/email", () => ({
  sendVerificationEmail: sendVerificationEmailMock,
}));

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(body),
  }) as NextRequest;
}

beforeEach(() => {
  process.env.NEXTAUTH_URL = "http://localhost:3000";
});

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
    sendVerificationEmailMock.mockResolvedValue({
      ok: true,
      provider: "console",
    });
  });

  it("creates a workspace and user for a new email", async () => {
    userFindUniqueMock.mockResolvedValue(null);
    workspaceCreateMock.mockResolvedValue({ id: "ws-1" });
    userCreateMock.mockResolvedValue({ id: "user-1" });
    emailVerificationTokenCreateMock.mockResolvedValue({ token: "token-123" });
    sendVerificationEmailMock.mockResolvedValue({
      ok: true,
      provider: "console",
    });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.message).toContain("check your email");
    expect(workspaceCreateMock).toHaveBeenCalled();
    expect(userCreateMock).toHaveBeenCalled();
    expect(emailVerificationTokenCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: validBody.email,
          token: expect.any(String),
        }),
      }),
    );
    expect(sendVerificationEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: validBody.email,
        verifyUrl: expect.stringContaining("/auth/verify-email?token="),
      }),
    );
  });

  it("returns 409 when email is already registered", async () => {
    userFindUniqueMock.mockResolvedValue({ id: "existing-user" });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(409);
    expect(workspaceCreateMock).not.toHaveBeenCalled();
  });

  it("rolls back the workspace when the verification email fails to send", async () => {
    userFindUniqueMock.mockResolvedValue(null);
    workspaceCreateMock.mockResolvedValue({ id: "ws-1" });
    userCreateMock.mockResolvedValue({ id: "user-1" });
    emailVerificationTokenCreateMock.mockResolvedValue({ token: "token-123" });
    sendVerificationEmailMock.mockResolvedValue({
      ok: false,
      provider: "resend",
      detail: "provider down",
    });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
    expect(workspaceDeleteMock).toHaveBeenCalledWith({ where: { id: "ws-1" } });
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
      const res = await POST(
        makeRequest({ ...validBody, email: `u${i}@example.com` }),
      );
      expect(res.status).toBe(201);
    }

    const blocked = await POST(
      makeRequest({ ...validBody, email: "blocked@example.com" }),
    );
    expect(blocked.status).toBe(429);
  });
});
