import { NextRequest, NextResponse } from "next/server";
import { getRequestContext, runWithRequestContext } from "./async-context";

/**
 * Wrap a Next.js App Router handler so it runs inside an AsyncLocalStorage
 * request context.
 *
 * The context carries a requestId (inherited from the `x-request-id` header or
 * generated), the request path, and the client IP. If the wrapped handler
 * resolves to a NextResponse, the response will include an `X-Request-Id`
 * header.
 */
export function withRequestContext<
  TArgs extends [NextRequest, ...unknown[]],
  TReturn extends NextResponse | Response,
>(handler: (...args: TArgs) => Promise<TReturn>) {
  return async (...args: TArgs): Promise<TReturn> => {
    const req = args[0];

    return runWithRequestContext(req, async () => {
      const response = await handler(...args);

      const requestId = getRequestContext()?.requestId;
      if (requestId && "headers" in response) {
        try {
          response.headers.set("X-Request-Id", requestId);
        } catch {
          // Some response types have immutable headers; skip in that case.
        }
      }

      return response;
    });
  };
}
