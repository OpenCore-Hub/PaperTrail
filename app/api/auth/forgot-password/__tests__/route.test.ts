import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

const {
  userFindUniqueMock,
  passwordResetTokenCreateMock,
} = vi.hoisted(() => ({
  userFindUniqueMock: vi.fn(),
  passwordResetTokenCreateMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: userFindUniqueMock,
    },
    passwordResetToken: {
      create: passwordResetTokenCreateMock,
    },
  },
}));

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(body),
  }) as NextRequest;
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_URL = "http://localhost:3000";
  });

  it("returns the same message for unknown emails", async () => {
    userFindUniqueMock.mockResolvedValue(null);

    const res = await POST(makeRequest({ email: "unknown@example.com" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toContain("If an account exists");
    expect(passwordResetTokenCreateMock).not.toHaveBeenCalled();
  });

  it("creates a reset token for existing password users", async () => {
    userFindUniqueMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      password: "hashed",
    });
    passwordResetTokenCreateMock.mockResolvedValue({ token: "token-123" });

    const res = await POST(makeRequest({ email: "user@example.com" }));
    expect(res.status).toBe(200);
    expect(passwordResetTokenCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "user@example.com",
          token: expect.any(String),
        }),
      }),
    );
  });

  it("returns 400 for invalid email", async () => {
    const res = await POST(makeRequest({ email: "not-an-email" }));
    expect(res.status).toBe(400);
  });
});
