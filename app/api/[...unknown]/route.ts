import { createNotFoundError } from "@/lib/api-utils";
import { NO_STORE_CACHE_CONTROL } from "@/lib/middleware/api-wrappers/cache-wrappers";

export const dynamic = "force-dynamic";

// Every /api path with no route of its own lands here; specific routes always
// match first, and Next answers HEAD from GET. Without this route, Next's own
// 404 gets the blanket `/api/*` max-age=60 from next.config and stays in
// browser and iOS caches.
//
// Browsers and iOS must not keep it (no-store). Vercel's CDN may: the body has
// no user data, the CDN cache is per deployment (a route added later is never
// hidden), and repeated probes of one path (scanners, old app builds calling a
// removed endpoint) then stop at the edge. Nothing else limits them: there is
// no firewall rule and proxy.ts does not match /api. This route skips
// withErrorNoStore on purpose, because that wrapper strips CDN cache headers;
// it cannot throw.
const UNKNOWN_API_CDN_CACHE = "max-age=300";

async function notFound(): Promise<Response> {
  const response = createNotFoundError("API route");
  response.headers.set("Cache-Control", NO_STORE_CACHE_CONTROL);
  response.headers.set("Vercel-CDN-Cache-Control", UNKNOWN_API_CDN_CACHE);
  return response;
}

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
export const OPTIONS = notFound;
