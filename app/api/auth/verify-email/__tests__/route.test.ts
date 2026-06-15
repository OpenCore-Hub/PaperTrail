import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { resetRateLimits } from "@/lib/rate-limit";

const {
  emailVerificationTokenFindUniqueMock,
  emailVerificationTokenDeleteMock,
  emailVerificationTokenDeleteManyMock,
  emailVerificationTokenCreateMock,
  userUpdateMock,
  userFindUniqueMock,
  sendVerificationEmailMock,
} = vi.hoisted(() => ({
  emailVerificationTokenFindUniqueMock: vi.fn(),
  emailVerificationTokenDeleteMock: vi.fn(),
  emailVerificationTokenDeleteManyMock: vi.fn(),
  emailVerificationTokenCreateMock: vi.fn(),
  userUpdateMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  sendVerificationEmailMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (ops: unknown[]) => {
      for (const op of ops) {
        await op;
      }
    }),
    emailVerificationToken: {
      findUnique: emailVerificationTokenFindUniqueMock,
      delete: emailVerificationTokenDeleteMock,
      deleteMany: emailVerificationTokenDeleteManyMock,
      create: emailVerificationTokenCreateMock,
    },
    user: {
      update: userUpdateMock,
      findUnique: userFindUniqueMock,
    },
  },
}));

vi.mock("@/lib/email", () => ({
  sendVerificationEmail: sendVerificationEmailMock,
}));

function makeGetRequest(token?: string): NextRequest {
  const url = token
    ? `http://localhost:3000/api/auth/verify-email?token=${token}`
    : "http://localhost:3000/api/auth/verify-email";
  return new NextRequest(url) as NextRequest;
}

function makePostRequest(body: object): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/verify-email", {
    method: "POST",
    body: JSON.stringify(body),
  }) as NextRequest;
}

describe("GET /api/auth/verify-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_URL = "http://localhost:3000";
  });

  it("verifies the email and redirects to sign-in when the token is valid", async () => {
    emailVerificationTokenFindUniqueMock.mockResolvedValue({
      id: "evt-1",
      email: "user@example.com",
      token: "valid-token",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const res = await GET(makeGetRequest("valid-token"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/signin?verified=1");
    expect(userUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "user@example.com" },
        data: { emailVerified: expect.any(Date) },
      }),
    );
    expect(emailVerificationTokenDeleteMock).toHaveBeenCalledWith({
      where: { id: "evt-1" },
    });
  });

  it("redirects to the error page for an expired token", async () => {
    emailVerificationTokenFindUniqueMock.mockResolvedValue({
      id: "evt-1",
      email: "user@example.com",
      token: "expired-token",
      expiresAt: new Date(Date.now() - 60 * 60 * 1000),
    });

    const res = await GET(makeGetRequest("expired-token"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain(
      "/auth/verify-email?error=invalid",
    );
    expect(userUpdateMock).not.toHaveBeenCalled();
  });

  it("redirects to the error page when the token is missing", async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain(
      "/auth/verify-email?error=missing",
    );
  });
});

describe("POST /api/auth/verify-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimits();
    process.env.NEXTAUTH_URL = "http://localhost:3000";
  });

  it("sends a new verification email for an existing unverified user", async () => {
    userFindUniqueMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      emailVerified: null,
      password: "hashed",
    });
    emailVerificationTokenCreateMock.mockResolvedValue({ token: "token-123" });
    sendVerificationEmailMock.mockResolvedValue({
      ok: true,
      provider: "console",
    });

    const res = await POST(makePostRequest({ email: "user@example.com" }));
    expect(res.status).toBe(200);
    expect(emailVerificationTokenDeleteManyMock).toHaveBeenCalledWith({
      where: { email: "user@example.com" },
    });
    expect(sendVerificationEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        verifyUrl: expect.stringContaining("/auth/verify-email?token="),
      }),
    );
  });

  it("returns the same response when the user does not exist", async () => {
    userFindUniqueMock.mockResolvedValue(null);

    const res = await POST(makePostRequest({ email: "missing@example.com" }));
    expect(res.status).toBe(200);
    expect(emailVerificationTokenCreateMock).not.toHaveBeenCalled();
  });

  it("returns the same response when the user is already verified", async () => {
    userFindUniqueMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      emailVerified: new Date(),
      password: "hashed",
    });

    const res = await POST(makePostRequest({ email: "user@example.com" }));
    expect(res.status).toBe(200);
    expect(emailVerificationTokenCreateMock).not.toHaveBeenCalled();
  });

  it("returns 429 after exceeding the rate limit", async () => {
    userFindUniqueMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      emailVerified: null,
      password: "hashed",
    });

    for (let i = 0; i < 10; i++) {
      const res = await POST(makePostRequest({ email: `u${i}@example.com` }));
      expect(res.status).toBe(200);
    }

    const blocked = await POST(
      makePostRequest({ email: "blocked@example.com" }),
    );
    expect(blocked.status).toBe(429);
  });
});
