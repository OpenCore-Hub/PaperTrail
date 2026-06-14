import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

const {
  passwordResetTokenFindUniqueMock,
  passwordResetTokenDeleteMock,
  userUpdateMock,
  transactionMock,
} = vi.hoisted(() => ({
  passwordResetTokenFindUniqueMock: vi.fn(),
  passwordResetTokenDeleteMock: vi.fn(),
  userUpdateMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    passwordResetToken: {
      findUnique: passwordResetTokenFindUniqueMock,
      delete: passwordResetTokenDeleteMock,
    },
    user: {
      update: userUpdateMock,
    },
    $transaction: transactionMock,
  },
}));

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(body),
  }) as NextRequest;
}

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid or expired token", async () => {
    passwordResetTokenFindUniqueMock.mockResolvedValue(null);

    const res = await POST(
      makeRequest({ token: "bad", password: "newpassword123" }),
    );
    expect(res.status).toBe(400);
  });

  it("updates password and deletes token when valid", async () => {
    passwordResetTokenFindUniqueMock.mockResolvedValue({
      id: "prt-1",
      email: "user@example.com",
      token: "valid-token",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    });
    transactionMock.mockImplementation(async (ops) => {
      for (const op of ops) await op;
      return [undefined, undefined];
    });

    const res = await POST(
      makeRequest({ token: "valid-token", password: "newpassword123" }),
    );
    expect(res.status).toBe(200);
    expect(transactionMock).toHaveBeenCalled();
  });

  it("returns 400 for short passwords", async () => {
    const res = await POST(makeRequest({ token: "valid", password: "short" }));
    expect(res.status).toBe(400);
  });
});
