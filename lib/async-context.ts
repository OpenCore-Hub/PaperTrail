import { AsyncLocalStorage } from "async_hooks";
import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { getClientIp } from "./ip";

export interface RequestContext {
  requestId: string;
  path: string;
  ip: string;
  userId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function runWithRequestContext<T>(
  req: NextRequest,
  fn: () => Promise<T>,
): Promise<T> {
  const existing = req.headers.get("x-request-id");
  const requestId = existing && existing.trim() ? existing.trim() : nanoid();

  const context: RequestContext = {
    requestId,
    path: req.nextUrl.pathname,
    ip: getClientIp(req),
  };

  return storage.run(context, fn);
}

export function setRequestUserId(userId: string): void {
  const context = storage.getStore();
  if (context) {
    context.userId = userId;
  }
}
