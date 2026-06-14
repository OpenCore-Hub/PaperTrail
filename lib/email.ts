import { Resend } from "resend";

export interface InviteEmailInput {
  to: string;
  workspaceName: string;
  inviteUrl: string;
  invitedByName?: string | null;
}

export interface SendResult {
  ok: boolean;
  provider: "resend" | "console";
  detail?: string;
}

/**
 * Send a workspace invitation email.
 *
 * If RESEND_API_KEY is configured, the email is sent via Resend.
 * Otherwise the invitation is logged to the console so local development
 * can proceed without a live email provider.
 */
export async function sendInviteEmail(input: InviteEmailInput): Promise<SendResult> {
  const from = process.env.EMAIL_FROM_ADDRESS || "onboarding@resend.dev";
  const subject = `You've been invited to join ${input.workspaceName} on DocHub`;
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Join ${input.workspaceName} on DocHub</h2>
      <p>${input.invitedByName ? `${input.invitedByName} invited` : "You were invited"} you to collaborate on documents.</p>
      <p>
        <a
          href="${input.inviteUrl}"
          style="display: inline-block; padding: 12px 24px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;"
        >
          Accept invitation
        </a>
      </p>
      <p style="color: #666; font-size: 13px;">
        Or copy this link into your browser:
        <br />
        <code>${input.inviteUrl}</code>
      </p>
      <p style="color: #666; font-size: 13px;">
        This invitation expires in 7 days.
      </p>
    </div>
  `;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log("[EMAIL FALLBACK] Invite email would be sent:");
    console.log(`  To: ${input.to}`);
    console.log(`  From: ${from}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Invite URL: ${input.inviteUrl}`);
    return { ok: true, provider: "console" };
  }

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from,
    to: input.to,
    subject,
    html,
  });

  if (result.error) {
    return {
      ok: false,
      provider: "resend",
      detail: result.error.message,
    };
  }

  return { ok: true, provider: "resend" };
}
