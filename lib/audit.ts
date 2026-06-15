import { getRequestContext } from "./async-context";
import { getRequestLogger } from "./logger";

export type AuditEvent =
  | "auth.signup"
  | "auth.signin"
  | "auth.signout"
  | "auth.password_reset_requested"
  | "auth.password_reset_completed"
  | "auth.email_verified"
  | "document.deleted"
  | "document.uploaded"
  | "share.created"
  | "share.updated"
  | "share.deleted"
  | "team.invite_sent"
  | "team.invite_accepted"
  | "team.member_updated"
  | "team.member_removed"
  | "user.deleted"
  | "user.data_exported";

interface AuditPayload {
  [key: string]: unknown;
}

/**
 * Write a structured audit event.
 *
 * Automatically includes request correlation (requestId, actor userId, IP)
 * when called inside a request context.
 */
export function audit(event: AuditEvent, payload: AuditPayload = {}): void {
  const context = getRequestContext();
  const log = getRequestLogger("audit");

  log.info(
    {
      event,
      actor: context?.userId,
      ip: context?.ip,
      requestId: context?.requestId,
      ...payload,
    },
    event,
  );
}
