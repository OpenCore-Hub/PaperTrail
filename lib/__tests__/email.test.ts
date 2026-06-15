import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sendMock = vi.fn();

const { ResendMock } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function MockResend(this: any) {
    this.emails = { send: sendMock };
  }
  return { ResendMock: MockResend };
});

vi.mock("resend", () => ({
  Resend: ResendMock,
}));

import { sendInviteEmail } from "@/lib/email";

describe("sendInviteEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RESEND_API_KEY;
    process.env.EMAIL_FROM_ADDRESS = "test@example.com";
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM_ADDRESS;
  });

  it("falls back to console logging when RESEND_API_KEY is missing", async () => {
    const consoleSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);

    const result = await sendInviteEmail({
      to: "invited@example.com",
      workspaceName: "Acme",
      inviteUrl: "http://localhost:3000/auth/invite?token=abc",
      invitedByName: "Alice",
    });

    expect(result.ok).toBe(true);
    expect(result.provider).toBe("console");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("EMAIL FALLBACK"),
    );
    consoleSpy.mockRestore();
  });

  it("sends via Resend when API key is configured", async () => {
    process.env.RESEND_API_KEY = "re_test";
    sendMock.mockResolvedValue({ data: { id: "email-1" }, error: null });

    const result = await sendInviteEmail({
      to: "invited@example.com",
      workspaceName: "Acme",
      inviteUrl: "http://localhost:3000/auth/invite?token=abc",
    });

    expect(result.ok).toBe(true);
    expect(result.provider).toBe("resend");
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "test@example.com",
        to: "invited@example.com",
        subject: expect.stringContaining("Acme"),
        html: expect.stringContaining("abc"),
      }),
    );
  });

  it("returns error details when Resend fails", async () => {
    process.env.RESEND_API_KEY = "re_test";
    sendMock.mockResolvedValue({ data: null, error: { message: "Bounced" } });

    const result = await sendInviteEmail({
      to: "invited@example.com",
      workspaceName: "Acme",
      inviteUrl: "http://localhost:3000/auth/invite?token=abc",
    });

    expect(result.ok).toBe(false);
    expect(result.provider).toBe("resend");
    expect(result.detail).toBe("Bounced");
  });
});
