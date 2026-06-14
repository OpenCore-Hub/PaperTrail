import { NextRequest } from "next/server";

/**
 * Extract the client IP from a Next.js request.
 *
 * Uses the first entry of the `x-forwarded-for` header when behind a reverse
 * proxy; otherwise falls back to NextRequest's built-in `ip`. Returns
 * "unknown" when neither is available.
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return req.ip ?? "unknown";
}
