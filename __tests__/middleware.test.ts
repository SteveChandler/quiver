/**
 * @jest-environment node
 */

import { middleware } from "@/middleware";

// Setup mock variables at the module level
let mockNext: any;
let mockRedirect: any;
const mockURL = jest.fn(() => ({}));
let mockUser: any = null;

// Mock modules before importing middleware
jest.mock("@supabase/ssr", () => ({
  createServerClient: jest.fn(() => ({
    auth: {
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
});
