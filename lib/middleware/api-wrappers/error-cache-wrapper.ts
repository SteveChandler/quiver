import * as Sentry from "@sentry/nextjs";
import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { DEFAULT_SECURITY_HEADERS } from "@/lib/api-utils";
import { redactSecrets } from "@/lib/monitoring/redact-secrets";
import { NO_STORE_CACHE_CONTROL } from "./cache-wrappers";

// Headers that let a CDN store a response apart from Cache-Control.
const CDN_CACHE_HEADERS = ["CDN-Cache-Control", "Vercel-CDN-Cache-Control"] as const;

function markNoStore(response: Response): Response {
  // Not a real Response (a test double): nothing a cache could keep.
  if (typeof response.headers?.set !== "function") return response;
  const current = response.headers.get("Cache-Control") ?? "";
  const cacheControl = /\bno-store\b/i.test(current) ? current : NO_STORE_CACHE_CONTROL;
  try {
    response.headers.set("Cache-Control", cacheControl);
    for (const header of CDN_CACHE_HEADERS) response.headers.delete(header);
    return response;
  } catch {
    // A passed-through fetch() response has immutable headers; copy it.
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", cacheControl);
    for (const header of CDN_CACHE_HEADERS) headers.delete(header);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}

/**
 * Keeps a failed GET out of every cache.
 *
 * `next.config.mjs` gives every `/api/*` response without its own Cache-Control
 * `private, max-age=60, stale-while-revalidate=120`, error responses included.
 * Browsers and iOS NSURLCache then replay a 401, 404 or 500 for up to three
 * minutes, for example the signed-out answer right after sign-in. This wrapper
 * marks every response with status 400 or more `no-store` and removes CDN
 * cache headers from it. It does not touch 1xx, 2xx or 3xx responses (304s and
 * redirects keep their headers). A thrown error is reported to Sentry and
 * becomes a `no-store` 500; Next's own control-flow errors are re-thrown.
 */
// An async handler keeps its exact type (every overload and parameter list),
// so callers and Next's route type check see the same GET as before.
export function withErrorNoStore<H extends (...args: never[]) => Promise<Response>>(handler: H): H;
export function withErrorNoStore<A extends unknown[], R extends Response>(
  handler: (...args: A) => R | Promise<R>
): (...args: A) => Promise<R>;
export function withErrorNoStore<A extends unknown[], R extends Response>(
  handler: (...args: A) => R | Promise<R>
): (...args: A) => Promise<R> {
  return async (...args: A): Promise<R> => {
    let response: R;
    try {
      response = await handler(...args);
    } catch (error) {
      unstable_rethrow(error);
      Sentry.captureException(error);
      console.error("Unhandled API GET error:", redactSecrets(error instanceof Error ? error.message : String(error)));
      return markNoStore(
        NextResponse.json(
          { success: false, error: "Internal server error", timestamp: new Date().toISOString() },
          { status: 500, headers: DEFAULT_SECURITY_HEADERS }
        )
      ) as R;
    }
    if (!(response.status >= 400)) return response;
    return markNoStore(response) as R;
  };
}
