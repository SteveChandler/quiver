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
    mockRedirect = jest.fn(() => ({}));
    mockUser = null;
    mockSession = null;
  });

  test("passes through for API routes", async () => {
    const request: any = { nextUrl: { pathname: "/api/health" }, method: "GET", headers: new Headers(), cookies: { get: () => undefined } };
    await middleware(request);
    expect(mockNext).toHaveBeenCalled();
  });

  test("redirects to sign-in for protected path when unauthenticated", async () => {
    const request: any = { nextUrl: { pathname: "/profile" }, url: "http://localhost/profile", method: "GET", headers: new Headers(), cookies: { get: () => undefined } };
    await middleware(request);
    expect(mockRedirect).toHaveBeenCalled();
  });

  test("redirects to sign-in for beach detail page when unauthenticated", async () => {
    const request: any = { nextUrl: { pathname: "/beach/blacks-beach" }, url: "http://localhost/beach/blacks-beach", method: "GET", headers: new Headers(), cookies: { get: () => undefined } };
    await middleware(request);
    expect(mockRedirect).toHaveBeenCalled();
  });

  test("redirects to sign-in for forecast page when unauthenticated", async () => {
    const request: any = { nextUrl: { pathname: "/forecast/123" }, url: "http://localhost/forecast/123", method: "GET", headers: new Headers(), cookies: { get: () => undefined } };
    await middleware(request);
    expect(mockRedirect).toHaveBeenCalled();
  });

  test("allows authenticated user to access beach page", async () => {
    mockUser = { id: "user-123", email: "test@example.com" };
    mockSession = { user: mockUser, access_token: "token" };
    const request: any = { nextUrl: { pathname: "/beach/blacks-beach" }, url: "http://localhost/beach/blacks-beach", method: "GET", headers: new Headers(), cookies: { get: () => undefined } };
    await middleware(request);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  test("allows authenticated user to access forecast page", async () => {
    mockUser = { id: "user-123", email: "test@example.com" };
    mockSession = { user: mockUser, access_token: "token" };
    const request: any = { nextUrl: { pathname: "/forecast/123" }, url: "http://localhost/forecast/123", method: "GET", headers: new Headers(), cookies: { get: () => undefined } };
    await middleware(request);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
