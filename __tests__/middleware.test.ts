/**
 * @jest-environment node
 */

import {
  config,
  proxy as middleware,
  shouldSetIpLocationCookie,
} from "@/proxy";

// Setup mock variables at the module level
let mockNext: any;
let mockRedirect: any;
let mockRewrite: any;
const mockURL = jest.fn(() => ({}));
let mockUser: any = null;
let mockSession: any = null;
let mockBeachRowsBySlug: Record<string, any> = {};

// Mock modules before importing middleware
jest.mock("@supabase/ssr", () => ({
  createServerClient: jest.fn(() => {
    let selectedSlug = "";
    const query: Record<string, jest.Mock> = {};
    query.select = jest.fn(() => query);
    query.eq = jest.fn((_column: string, value: string) => {
      selectedSlug = value;
      return query;
    });
    query.or = jest.fn(() => query);
    query.limit = jest.fn(() =>
      Promise.resolve({
        data: mockBeachRowsBySlug[selectedSlug]
          ? [mockBeachRowsBySlug[selectedSlug]]
          : [],
        error: null,
      })
    );

    return {
      auth: {
        getSession: () => Promise.resolve({ data: { session: mockSession }, error: null }),
        getUser: () => Promise.resolve({ data: { user: mockUser }, error: null }),
      },
      from: jest.fn(() => query),
    };
  }),
}));

jest.mock("@/lib/data/forecast-regions", () => ({
  getForecastRegion: (slug: string) =>
    slug === "san-diego" ? { slug: "san-diego" } : undefined,
}));

jest.mock("next/server", () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    get next() {
      return mockNext;
    },
    get redirect() {
      return mockRedirect;
    },
    get rewrite() {
      return mockRewrite;
    },
  },
}));

// Do not override global.URL; rely on Node's URL implementation

describe("Middleware", () => {
  beforeEach(() => {
    mockNext = jest.fn(() => ({ headers: new Headers(), cookies: { set: jest.fn(), delete: jest.fn() } }));
    mockRedirect = jest.fn(() => ({
      headers: new Headers(),
      cookies: { set: jest.fn(), delete: jest.fn() },
    }));
    mockRewrite = jest.fn(() => ({
      headers: new Headers(),
      cookies: { set: jest.fn(), delete: jest.fn() },
    }));
    mockUser = null;
    mockSession = null;
    mockBeachRowsBySlug = {};
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  test("keeps regional forecast responses free of the IP location cookie", () => {
    expect(shouldSetIpLocationCookie("/forecast/san-diego")).toBe(false);
    expect(shouldSetIpLocationCookie("/forecast/san-diego/")).toBe(false);
    expect(shouldSetIpLocationCookie("/forecast")).toBe(true);
    expect(shouldSetIpLocationCookie("/forecast/123")).toBe(true);
    expect(shouldSetIpLocationCookie("/ca/san-diego/ocean-beach")).toBe(true);
  });

  test("passes through for API routes", async () => {
    const request: any = { nextUrl: { pathname: "/api/health" }, method: "GET", headers: new Headers(), cookies: { get: () => undefined, getAll: () => [] } };
    await middleware(request);
    expect(mockNext).toHaveBeenCalled();
  });

  test.each([
    "/images/landing/swell-view-preview-v2.png",
    "/images/hero/quiver-landing-hero-poster.jpg",
    "/images/quiver-stickers/orange-tape.png",
    "/videos/quiver-landing-hero-720.mp4",
  ])("passes static asset %s through before SEO rewrites", async (pathname) => {
    const request: any = {
      nextUrl: { pathname },
      url: `http://localhost${pathname}`,
      method: "GET",
      headers: new Headers(),
      cookies: { get: () => undefined, getAll: () => [] },
    };

    await middleware(request);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockRewrite).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  test("excludes extension-bearing assets from the proxy matcher", () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);

    expect(matcher.test("/images/landing/swell-view-preview-v2.png")).toBe(false);
    expect(matcher.test("/fonts/SpaceGrotesk/SpaceGrotesk-Bold.ttf")).toBe(false);
    expect(matcher.test("/profile/jane.doe/settings")).toBe(true);
    expect(matcher.test("/mexico/baja-california/rosarito")).toBe(true);
    expect(matcher.test("/vs/surfline/free")).toBe(true);
  });

  test("does not treat a dotted parent segment as a static asset", async () => {
    const pathname = "/profile/jane.doe/settings";
    const request: any = {
      nextUrl: { pathname },
      url: `http://localhost${pathname}`,
      method: "GET",
      headers: new Headers(),
      cookies: { get: () => undefined, getAll: () => [] },
    };

    await middleware(request);

    expect(mockRedirect).toHaveBeenCalledTimes(1);
    expect(mockRewrite).not.toHaveBeenCalled();
  });

  test("allows / for Capacitor UA when unauthenticated (landing page is public)", async () => {
    const headers = new Headers([
      ["user-agent", "Capacitor"],
    ]);
    const request: any = {
      nextUrl: { pathname: "/", search: "" },
      url: "http://localhost/",
      method: "GET",
      headers,
      cookies: { get: () => undefined, getAll: () => [] },
    };
    await middleware(request);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  test("allows /?signup=confirm-email for Capacitor UA when unauthenticated", async () => {
    const headers = new Headers([
      ["user-agent", "Capacitor"],
    ]);
    const request: any = {
      nextUrl: { pathname: "/", search: "?signup=confirm-email" },
      url: "http://localhost/?signup=confirm-email",
      method: "GET",
      headers,
      cookies: { get: () => undefined, getAll: () => [] },
    };
    await middleware(request);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  test("allows / for Capacitor UA when Supabase auth cookie is present", async () => {
    const headers = new Headers([
      ["user-agent", "Capacitor"],
      ["cookie", "sb-vawdnbbgawichorsjiwe-auth-token.0=abc123; other=1"],
    ]);
    const request: any = {
      nextUrl: { pathname: "/", search: "" },
      url: "http://localhost/",
      method: "GET",
      headers,
      cookies: { get: () => undefined, getAll: () => [] },
    };
    await middleware(request);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  test("redirects to sign-in for protected path when unauthenticated", async () => {
    const request: any = { nextUrl: { pathname: "/profile" }, url: "http://localhost/profile", method: "GET", headers: new Headers(), cookies: { get: () => undefined, getAll: () => [] } };
    await middleware(request);
    expect(mockRedirect).toHaveBeenCalled();
  });

  test("allows /sessions/new email token fallback when unauthenticated", async () => {
    const request: any = {
      nextUrl: {
        pathname: "/sessions/new",
        search: "?token=signed-token",
        searchParams: new URLSearchParams("token=signed-token"),
      },
      url: "http://localhost/sessions/new?token=signed-token",
      method: "GET",
      headers: new Headers(),
      cookies: { get: () => undefined, getAll: () => [] },
    };

    await middleware(request);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  test("allows /sessions/new email attribution bridge when unauthenticated", async () => {
    const search =
      "?entrySource=email&utm_medium=email&email_type=manual_attribution_test&message_instance_id=manual-email-attribution-20260708-1015";
    const request: any = {
      nextUrl: {
        pathname: "/sessions/new",
        search,
        searchParams: new URLSearchParams(search.slice(1)),
      },
      url: `http://localhost/sessions/new${search}`,
      method: "GET",
      headers: new Headers(),
      cookies: { get: () => undefined, getAll: () => [] },
    };

    await middleware(request);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  test("allows unauthenticated access to beach detail page (public for SEO)", async () => {
    const request: any = { nextUrl: { pathname: "/beach/blacks-beach" }, url: "http://localhost/beach/blacks-beach", method: "GET", headers: new Headers(), cookies: { get: () => undefined, getAll: () => [] } };
    await middleware(request);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  test("allows unauthenticated regional forecasts without setting response cookies", async () => {
    const request: any = { nextUrl: { pathname: "/forecast/san-diego" }, url: "http://localhost/forecast/san-diego", method: "GET", headers: new Headers(), cookies: { get: () => undefined, getAll: () => [] } };
    const response = await middleware(request);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(response.cookies.set).not.toHaveBeenCalled();
  });

  test("does not rewrite app spot handoff routes as international city pages", async () => {
    const request: any = {
      nextUrl: {
        pathname: "/app/spot/la-jolla-shores",
        search: "?window=phase20-smoke",
        clone: () => ({
          pathname: "/app/spot/la-jolla-shores",
          search: "?window=phase20-smoke",
        }),
      },
      url: "http://localhost/app/spot/la-jolla-shores?window=phase20-smoke",
      method: "GET",
      headers: new Headers(),
      cookies: { get: () => undefined, getAll: () => [] },
    };

    await middleware(request);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRewrite).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  test("allows authenticated user to access beach page", async () => {
    mockUser = { id: "user-123", email: "test@example.com" };
    mockSession = { user: mockUser, access_token: "token" };
    const request: any = { nextUrl: { pathname: "/beach/blacks-beach" }, url: "http://localhost/beach/blacks-beach", method: "GET", headers: new Headers(), cookies: { get: () => undefined, getAll: () => [] } };
    await middleware(request);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  test("allows authenticated user to access forecast page", async () => {
    mockUser = { id: "user-123", email: "test@example.com" };
    mockSession = { user: mockUser, access_token: "token" };
    const request: any = { nextUrl: { pathname: "/forecast/123" }, url: "http://localhost/forecast/123", method: "GET", headers: new Headers(), cookies: { get: () => undefined, getAll: () => [] } };
    await middleware(request);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  test("redirects /pr/rinc-n to /pr/rincon (canonical slug for Rincón)", async () => {
    const clonedUrl = { pathname: "/pr/rinc-n" };
    const request: any = {
      nextUrl: {
        pathname: "/pr/rinc-n",
        clone: () => clonedUrl,
      },
      url: "http://localhost/pr/rinc-n",
      method: "GET",
      headers: new Headers(),
      cookies: { get: () => undefined, getAll: () => [] },
    };
    await middleware(request);
    expect(mockRedirect).toHaveBeenCalled();
    expect(clonedUrl.pathname).toBe("/pr/rincon");
  });

  test("redirects /ca/orange-county/{beach} directly to canonical beach URL", async () => {
    mockBeachRowsBySlug["seal-beach"] = {
      slug: "seal-beach",
      city: "Seal Beach",
      state: "CA",
      country: "USA",
    };
    const clonedUrl = { pathname: "/ca/orange-county/seal-beach" };
    const request: any = {
      nextUrl: {
        pathname: "/ca/orange-county/seal-beach",
        clone: () => clonedUrl,
      },
      url: "http://localhost/ca/orange-county/seal-beach",
      method: "GET",
      headers: new Headers(),
      cookies: { get: () => undefined, getAll: () => [] },
    };
    await middleware(request);
    expect(mockRedirect).toHaveBeenCalledWith(clonedUrl, { status: 301 });
    expect(clonedUrl.pathname).toBe("/ca/seal-beach/seal-beach-pier-seal-beach-ca");
  });

  test("redirects /CA/Orange-County/{beach} case-insensitively to canonical beach URL", async () => {
    mockBeachRowsBySlug["bolsa-chica"] = {
      slug: "bolsa-chica",
      city: "Huntington Beach",
      state: "CA",
      country: "USA",
    };
    const clonedUrl = { pathname: "/CA/Orange-County/Bolsa-Chica" };
    const request: any = {
      nextUrl: {
        pathname: "/CA/Orange-County/Bolsa-Chica",
        clone: () => clonedUrl,
      },
      url: "http://localhost/CA/Orange-County/Bolsa-Chica",
      method: "GET",
      headers: new Headers(),
      cookies: { get: () => undefined, getAll: () => [] },
    };
    await middleware(request);
    expect(mockRedirect).toHaveBeenCalledWith(clonedUrl, { status: 301 });
    expect(clonedUrl.pathname).toBe("/ca/huntington-beach/bolsa-chica");
  });

  test("redirects /spots/{known} directly with a literal 301", async () => {
    mockBeachRowsBySlug["ocean-beach"] = {
      slug: "ocean-beach",
      city: "San Diego",
      state: "CA",
      country: "USA",
    };
    const clonedUrl = { pathname: "/spots/ocean-beach" };
    const request: any = {
      nextUrl: {
        pathname: "/spots/ocean-beach",
        clone: () => clonedUrl,
      },
      url: "http://localhost/spots/ocean-beach",
      method: "GET",
      headers: new Headers(),
      cookies: { get: () => undefined, getAll: () => [] },
    };

    await middleware(request);

    expect(mockRedirect).toHaveBeenCalledWith(clonedUrl, { status: 301 });
    expect(clonedUrl.pathname).toBe("/ca/san-diego/ocean-beach");
  });

  test("redirects legacy /spots slug aliases directly to canonical beach URL", async () => {
    mockBeachRowsBySlug["lower-trestles"] = {
      slug: "lower-trestles",
      city: "San Onofre",
      state: "CA",
      country: "USA",
    };
    const clonedUrl = { pathname: "/spots/lowers-trestles" };
    const request: any = {
      nextUrl: {
        pathname: "/spots/lowers-trestles",
        clone: () => clonedUrl,
      },
      url: "http://localhost/spots/lowers-trestles",
      method: "GET",
      headers: new Headers(),
      cookies: { get: () => undefined, getAll: () => [] },
    };

    await middleware(request);

    expect(mockRedirect).toHaveBeenCalledWith(clonedUrl, { status: 301 });
    expect(clonedUrl.pathname).toBe("/ca/san-onofre/lower-trestles");
  });

  test("redirects extra-segment state beach URLs without routing through /spots", async () => {
    const clonedUrl = {
      pathname: "/hi/koloa-hi/waikoloa-village-lagoon/extra",
    };
    const request: any = {
      nextUrl: {
        pathname: "/hi/koloa-hi/waikoloa-village-lagoon/extra",
        clone: () => clonedUrl,
      },
      url: "http://localhost/hi/koloa-hi/waikoloa-village-lagoon/extra",
      method: "GET",
      headers: new Headers(),
      cookies: { get: () => undefined, getAll: () => [] },
    };

    await middleware(request);

    expect(mockRedirect).toHaveBeenCalledWith(clonedUrl, { status: 301 });
    expect(clonedUrl.pathname).toBe("/hi/koloa-hi/waikoloa-village-lagoon");
  });

  test("redirects legacy North HB Streets slug to Goldenwest", async () => {
    const clonedUrl = { pathname: "/ca/huntington-beach/north-hb-streets" };
    const request: any = {
      nextUrl: {
        pathname: "/ca/huntington-beach/north-hb-streets",
        clone: () => clonedUrl,
      },
      url: "http://localhost/ca/huntington-beach/north-hb-streets",
      method: "GET",
      headers: new Headers(),
      cookies: { get: () => undefined, getAll: () => [] },
    };
    await middleware(request);
    expect(mockRedirect).toHaveBeenCalled();
    expect(clonedUrl.pathname).toBe("/ca/huntington-beach/goldenwest");
  });

  test("redirects legacy North HB Streets subpages to Goldenwest subpages", async () => {
    const clonedUrl = {
      pathname: "/ca/huntington-beach/north-hb-streets/tides",
    };
    const request: any = {
      nextUrl: {
        pathname: "/ca/huntington-beach/north-hb-streets/tides",
        clone: () => clonedUrl,
      },
      url: "http://localhost/ca/huntington-beach/north-hb-streets/tides",
      method: "GET",
      headers: new Headers(),
      cookies: { get: () => undefined, getAll: () => [] },
    };
    await middleware(request);
    expect(mockRedirect).toHaveBeenCalled();
    expect(clonedUrl.pathname).toBe("/ca/huntington-beach/goldenwest/tides");
  });

  test("redirects legacy Rockview slug to The Hook canonical URL", async () => {
    const clonedUrl = { pathname: "/ca/santa-cruz/rockview-santa-cruz-ca" };
    const request: any = {
      nextUrl: {
        pathname: "/ca/santa-cruz/rockview-santa-cruz-ca",
        clone: () => clonedUrl,
      },
      url: "http://localhost/ca/santa-cruz/rockview-santa-cruz-ca",
      method: "GET",
      headers: new Headers(),
      cookies: { get: () => undefined, getAll: () => [] },
    };
    await middleware(request);
    expect(mockRedirect).toHaveBeenCalled();
    expect(clonedUrl.pathname).toBe("/ca/santa-cruz/the-hook-santa-cruz-ca");
  });

  test("redirects legacy Rockview subpages to The Hook subpages", async () => {
    const clonedUrl = {
      pathname: "/ca/santa-cruz/rockview-santa-cruz-ca/water-temp",
    };
    const request: any = {
      nextUrl: {
        pathname: "/ca/santa-cruz/rockview-santa-cruz-ca/water-temp",
        clone: () => clonedUrl,
      },
      url: "http://localhost/ca/santa-cruz/rockview-santa-cruz-ca/water-temp",
      method: "GET",
      headers: new Headers(),
      cookies: { get: () => undefined, getAll: () => [] },
    };
    await middleware(request);
    expect(mockRedirect).toHaveBeenCalled();
    expect(clonedUrl.pathname).toBe(
      "/ca/santa-cruz/the-hook-santa-cruz-ca/water-temp"
    );
  });

  test("redirects legacy Rockview spots URL to The Hook canonical URL", async () => {
    const clonedUrl = { pathname: "/spots/rockview-santa-cruz-ca" };
    const request: any = {
      nextUrl: {
        pathname: "/spots/rockview-santa-cruz-ca",
        clone: () => clonedUrl,
      },
      url: "http://localhost/spots/rockview-santa-cruz-ca",
      method: "GET",
      headers: new Headers(),
      cookies: { get: () => undefined, getAll: () => [] },
    };
    await middleware(request);
    expect(mockRedirect).toHaveBeenCalled();
    expect(clonedUrl.pathname).toBe("/ca/santa-cruz/the-hook-santa-cruz-ca");
  });

  test("redirects legacy Rockview beach URL to The Hook canonical URL", async () => {
    const clonedUrl = { pathname: "/beach/rockview-santa-cruz-ca" };
    const request: any = {
      nextUrl: {
        pathname: "/beach/rockview-santa-cruz-ca",
        clone: () => clonedUrl,
      },
      url: "http://localhost/beach/rockview-santa-cruz-ca",
      method: "GET",
      headers: new Headers(),
      cookies: { get: () => undefined, getAll: () => [] },
    };
    await middleware(request);
    expect(mockRedirect).toHaveBeenCalled();
    expect(clonedUrl.pathname).toBe("/ca/santa-cruz/the-hook-santa-cruz-ca");
  });
});
