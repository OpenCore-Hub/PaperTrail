import { createLogger } from "./logger";

export interface AuditEvent {
  action: string;
  actor: { userId: string; workspaceId?: string };
  resource: { type: string; id: string };
  metadata?: Record<string, unknown>;
}

const log = createLogger("audit");

/**
 * Records a structured audit event.
 *
 * v0.3 implementation writes to the application log. A future iteration can
 * persist events to an `audit_logs` table for long-term retention and querying.
 */
export async function audit(event: AuditEvent): Promise<void> {
  log.info(event, event.action);
}
