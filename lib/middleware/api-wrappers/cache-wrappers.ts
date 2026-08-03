import type { RouteHandler } from "./types";

/**
 * Cache-Control value for per-user API responses.
 *
 * `next.config.mjs` blanket-caches `/api/*` for 60s and the native app's
 * NSURLCache honors response headers, so any personalized route that loses
 * this header serves one user's payload to another (or stale data) for up
 * to a minute. Keep every personalized route on `withNoStore`.
 */
export const NO_STORE_CACHE_CONTROL =
  "private, no-store, no-cache, must-revalidate";

/** Wraps a route handler so its response is never cached (see NO_STORE_CACHE_CONTROL). */
export function withNoStore(handler: RouteHandler): RouteHandler {
  return async (request, context) => {
    const response = await handler(request, context);
    response.headers.set("Cache-Control", NO_STORE_CACHE_CONTROL);
    return response;
  };
}
