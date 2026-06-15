import { isAllowed } from "@/lib/rate-limit";

const AI_QUERY_WINDOW = {
  maxRequests: 200,
  windowMs: 60 * 60 * 1000, // 1 hour
};

/**
 * Check whether a workspace is allowed to make another AI query.
 *
 * Limit: 200 queries per workspace per hour. Falls back to an in-memory
 * bucket if Redis is unavailable.
 */
export async function checkAiQueryAllowed(workspaceId: string): Promise<boolean> {
  return isAllowed(`ai:query:${workspaceId}`, AI_QUERY_WINDOW);
}
