/**
 * @jest-environment node
 */

import { middleware } from "@/middleware";

// Setup mock variables at the module level
let mockNext: any;
let mockRedirect: any;
const mockURL = jest.fn(() => ({}));
let mockUser: any = null;
let mockSession: any = null;

// Mock modules before importing middleware
jest.mock("@supabase/ssr", () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: mockSession }, error: null }),
      getUser: () => Promise.resolve({ data: { user: mockUser }, error: null }),
    },
  })),
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
    mockUser = null;
    mockSession = null;
  });

  test("passes through for API routes", async () => {
    const request: any = { nextUrl: { pathname: "/api/health" }, method: "GET", headers: new Headers(), cookies: { get: () => undefined, getAll: () => [] } };
    await middleware(request);
    expect(mockNext).toHaveBeenCalled();
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

  test("allows unauthenticated access to beach detail page (public for SEO)", async () => {
    const request: any = { nextUrl: { pathname: "/beach/blacks-beach" }, url: "http://localhost/beach/blacks-beach", method: "GET", headers: new Headers(), cookies: { get: () => undefined, getAll: () => [] } };
    await middleware(request);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  test("allows unauthenticated access to forecast page (public for SEO)", async () => {
    const request: any = { nextUrl: { pathname: "/forecast/123" }, url: "http://localhost/forecast/123", method: "GET", headers: new Headers(), cookies: { get: () => undefined, getAll: () => [] } };
    await middleware(request);
    expect(mockNext).toHaveBeenCalled();
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

  test("redirects /ca/orange-county/{beach} to /spots/{beach} (legacy OC URLs)", async () => {
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
    expect(mockRedirect).toHaveBeenCalled();
    expect(clonedUrl.pathname).toBe("/spots/seal-beach");
  });

  test("redirects /CA/Orange-County/{beach} case-insensitively", async () => {
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
    expect(mockRedirect).toHaveBeenCalled();
    expect(clonedUrl.pathname).toBe("/spots/bolsa-chica");
  });
});
