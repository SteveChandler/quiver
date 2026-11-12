/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from "next/server";

// Use Next's real control-flow errors and unstable_rethrow, not the jest.setup mock.
jest.mock("next/navigation", () => jest.requireActual("next/navigation"));
import { redirect, notFound } from "next/navigation";

const mockCaptureException = jest.fn();
jest.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

import { withErrorNoStore } from "@/lib/middleware/api-wrappers/error-cache-wrapper";
import { NO_STORE_CACHE_CONTROL } from "@/lib/middleware/api-wrappers/cache-wrappers";
import {
  createAuthError,
  createNotFoundError,
  createSuccessResponse,
  createCachedResponse,
  CacheDuration,
} from "@/lib/api-utils";

const BLANKET = "private, max-age=60, stale-while-revalidate=120";

// Route handlers are called by Next with a request; zero-argument test handlers
// take the RouteHandler overload, so call them the same way.
function call(handler: (req: NextRequest) => Promise<Response>): Promise<Response> {
  return withErrorNoStore(handler)(new NextRequest("https://x.test/api/thing"));
}

describe("withErrorNoStore", () => {
  beforeEach(() => {
    mockCaptureException.mockClear();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("marks a 401 from a route with no header of its own no-store", async () => {
    const res = await call(async () => createAuthError());
    expect(res.status).toBe(401);
    expect(res.headers.get("Cache-Control")).toBe(NO_STORE_CACHE_CONTROL);
  });

  it("marks a 404 no-store and removes CDN cache headers from it", async () => {
    const res = await call(async () => {
      const r = createNotFoundError("Buoy");
      r.headers.set("Vercel-CDN-Cache-Control", "public, max-age=900");
      r.headers.set("CDN-Cache-Control", "public, max-age=900");
      r.headers.set("Cache-Control", BLANKET);
      return r;
    });
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe(NO_STORE_CACHE_CONTROL);
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBeNull();
    expect(res.headers.get("CDN-Cache-Control")).toBeNull();
  });

  it("marks a 429 and a raw 503 no-store", async () => {
    const r429 = await call(async () =>
      NextResponse.json({ error: "slow down" }, { status: 429, headers: { "Retry-After": "30" } })
    );
    expect(r429.headers.get("Cache-Control")).toBe(NO_STORE_CACHE_CONTROL);
    expect(r429.headers.get("Retry-After")).toBe("30");
    const r503 = await call(async () => new Response("down", { status: 503 }));
    expect(r503.headers.get("Cache-Control")).toBe(NO_STORE_CACHE_CONTROL);
  });

  it("turns a thrown error into a no-store 500, reports it, and does not leak its message", async () => {
    const boom = new Error("db password=hunter2 timed out");
    const res = await call(async (): Promise<Response> => {
      throw boom;
    });
    expect(res.status).toBe(500);
    expect(res.headers.get("Cache-Control")).toBe(NO_STORE_CACHE_CONTROL);
    expect(mockCaptureException).toHaveBeenCalledWith(boom);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
    expect(JSON.stringify(body)).not.toContain("hunter2");
  });

  it("re-throws Next control-flow errors instead of turning them into a 500", async () => {
    await expect(call(async () => redirect("/elsewhere"))).rejects.toThrow();
    await expect(call(async () => notFound())).rejects.toThrow();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("returns a 2xx response untouched, headers and object included", async () => {
    const plain = createSuccessResponse({ ok: true });
    expect(await call(async () => plain)).toBe(plain);
    expect(plain.headers.get("Cache-Control")).toBeNull();

    const cached = await createCachedResponse({ ok: true }, CacheDuration.SHORT);
    const before = Array.from(cached.headers.entries());
    const after = await call(async () => cached);
    expect(after).toBe(cached);
    expect(Array.from(after.headers.entries())).toEqual(before);

    const withCdn = NextResponse.json({ ok: true });
    withCdn.headers.set("Vercel-CDN-Cache-Control", "public, max-age=900");
    const kept = await call(async () => withCdn);
    expect(kept.headers.get("Vercel-CDN-Cache-Control")).toBe("public, max-age=900");
  });

  it("returns 304 and redirects untouched", async () => {
    const notModified = new NextResponse(null, { status: 304, headers: { ETag: '"a"', "Cache-Control": "public, max-age=300" } });
    expect(await call(async () => notModified)).toBe(notModified);
    expect(notModified.headers.get("Cache-Control")).toBe("public, max-age=300");

    const moved = NextResponse.redirect("https://www.quiversurf.app/x", 308);
    moved.headers.set("Cache-Control", "public, max-age=86400");
    expect(await call(async () => moved)).toBe(moved);
    expect(moved.headers.get("Cache-Control")).toBe("public, max-age=86400");
  });

  it("copies an error response whose headers are immutable", async () => {
    const upstream = new Response("bad gateway", { status: 502, headers: { "Cache-Control": BLANKET } });
    Object.defineProperty(upstream, "headers", {
      value: new Proxy(upstream.headers, {
        get(target, prop) {
          if (prop === "set" || prop === "delete") {
            return () => {
              throw new TypeError("immutable");
            };
          }
          const value = Reflect.get(target, prop, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      }),
    });
    const res = await call(async () => upstream);
    expect(res.status).toBe(502);
    expect(res.headers.get("Cache-Control")).toBe(NO_STORE_CACHE_CONTROL);
    expect(await res.text()).toBe("bad gateway");
  });

  it("passes the request and route context through", async () => {
    const handler = jest.fn(async (_req: Request, ctx: { params: Promise<{ id: string }> }) =>
      NextResponse.json({ id: (await ctx.params).id })
    );
    const req = new Request("https://x.test/api/thing/7");
    const ctx = { params: Promise.resolve({ id: "7" }) };
    const res = await withErrorNoStore(handler)(req, ctx);
    expect(handler).toHaveBeenCalledWith(req, ctx);
    expect(await res.json()).toEqual({ id: "7" });
  });
});
