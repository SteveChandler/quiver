/**
 * Middleware Integration Tests
 *
 * Tests end-to-end middleware behavior including:
 * - Full authentication flows
 * - Route protection scenarios
 * - Admin authorization flows
 * - Edge cases and error handling
 */

import { NextRequest, NextResponse } from "next/server";
import { proxy as middleware } from "@/proxy";
import { readFileSync } from "fs";

// Mock dependencies
jest.mock("@/lib/middleware/api-wrappers", () => ({
  DEFAULT_SECURITY_HEADERS: {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
  },
}));

jest.mock("@/lib/middleware/auth-validator");
// Don't mock RouteGuard - we'll use the real implementation
jest.mock("@/lib/middleware/admin-checker");
jest.mock("@/lib/auth/admin", () => ({
  ADMIN_USER_IDS: ["bcdc5d59-2e22-4006-98a6-cada8618577a"],
}));

// Mock @supabase/ssr to prevent real network calls from refreshSession()
jest.mock("@supabase/ssr", () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  })),
}));

// Mock seo-redirect-handler to prevent fetch() calls to Supabase REST API
jest.mock("@/lib/middleware/seo-redirect-handler", () => ({
  handleSeoRedirect: jest.fn().mockResolvedValue({ redirect: false }),
}));

// Mock attribution and ip-location to prevent side effects
jest.mock("@/lib/attribution", () => ({
  parseUTMParams: jest.fn(() => ({})),
  parseAttributionFromRequestCookies: jest.fn(() => null),
  generateAttributionCookieHeaders: jest.fn(() => []),
}));
jest.mock("@/lib/location/ip-location", () => ({
  extractIPLocation: jest.fn(() => null),
  serializeIPLocation: jest.fn(() => ""),
  getIPLocationCookieName: jest.fn(() => "ip_location"),
}));

import { AuthValidator } from "@/lib/middleware/auth-validator";
import { RouteGuard } from "@/lib/middleware/route-guard";
import { AdminChecker } from "@/lib/middleware/admin-checker";

describe("Middleware Integration Tests", () => {
  const proxySource = readFileSync("proxy.ts", "utf8");

  let mockAuthValidator: jest.Mocked<AuthValidator>;
  let mockAdminChecker: jest.Mocked<AdminChecker>;

  // Helper to create mock NextRequest
  const createMockRequest = (pathname: string, search: string = ""): any => {
    const url = `http://localhost:3000${pathname}${search}`;
    return {
      nextUrl: {
        pathname,
        search,
        searchParams: new URLSearchParams(search.replace(/^\?/, "")),
        clone: () => new URL(url),
      },
      url,
      method: "GET",
      headers: new Headers(),
      cookies: {
        get: jest.fn(() => undefined),
        getAll: jest.fn(() => []),
        set: jest.fn(),
        delete: jest.fn(),
      },
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock AuthValidator
    mockAuthValidator = {
      validateAuth: jest.fn(),
    } as any;

    (AuthValidator as jest.Mock).mockImplementation(() => mockAuthValidator);

    // Mock AdminChecker
    mockAdminChecker = {
      checkAdminStatus: jest.fn(),
    } as any;

    (AdminChecker as jest.Mock).mockImplementation(() => mockAdminChecker);
  });

  it("uses the API wrapper barrel for default security headers", () => {
    expect(proxySource).not.toContain("@/lib/api-utils");
    expect(proxySource).toContain("@/lib/middleware/api-wrappers");
  });

  describe("Public Route Access", () => {
    it("should allow unauthenticated access to public routes", async () => {
      const publicRoutes = ["/", "/map", "/beach/123", "/forecast"];

      for (const path of publicRoutes) {
        // Create a mock request object compatible with middleware
        const request: any = {
          nextUrl: {
            pathname: path,
            search: "",
            searchParams: new URLSearchParams(),
          },
          url: `http://localhost:3000${path}`,
          method: "GET",
          headers: new Headers(),
          cookies: {
            get: jest.fn(() => undefined),
            getAll: jest.fn(() => []),
            set: jest.fn(),
            delete: jest.fn(),
          },
        };

        const response = await middleware(request);

        expect(response.status).not.toBe(307); // Not redirected
        expect(mockAuthValidator.validateAuth).not.toHaveBeenCalled();
      }
    });

    it("allows an unauthenticated UUID profile share without redirecting to sign-in", async () => {
      const request = createMockRequest(
        "/profile/bcacdc51-b01b-4702-ac0b-fb492c0a926a",
      );

      const response = await middleware(request);

      expect(response.status).not.toBe(307);
      expect(response.headers.get("location")).toBeNull();
      expect(mockAuthValidator.validateAuth).not.toHaveBeenCalled();
    });

    it("should add security headers to public routes", async () => {
      const request: any = {
        nextUrl: {
          pathname: "/map",
          search: "",
          searchParams: new URLSearchParams(),
        },
        url: "http://localhost:3000/map",
        method: "GET",
        headers: new Headers(),
        cookies: {
          get: jest.fn(() => undefined),
          getAll: jest.fn(() => []),
          set: jest.fn(),
          delete: jest.fn(),
        },
      };

      const response = await middleware(request);

      expect(response.headers.get("X-Frame-Options")).toBe("DENY");
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    });
  });

  describe("Location Page Shortcut Redirects", () => {
    it("should redirect /beaches/{state}/{city} to /{state}/{city} (301)", async () => {
      const request = createMockRequest("/beaches/ca/san-diego");

      const response = await middleware(request);

      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/ca/san-diego"
      );
    });

    it("should preserve query params when redirecting shortcut URLs", async () => {
      const request = createMockRequest("/beaches/ca/san-diego", "?utm_source=test");

      const response = await middleware(request);

      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/ca/san-diego?utm_source=test"
      );
    });

    it("should not redirect when the {state} segment is not a valid state slug", async () => {
      const request = createMockRequest("/beaches/surf-forecast/la-jolla");

      const response = await middleware(request);

      // Should not be a redirect response
      expect(response.status).not.toBe(308);
      expect(response.headers.get("location")).toBeNull();
    });
  });

  describe("Canonical City URL Routing", () => {
    it("should 301 redirect /beaches/usa/{state}/{city} to /{state}/{city}", async () => {
      const request = createMockRequest("/beaches/usa/hi/haleiwa");

      const response = await middleware(request);

      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/hi/haleiwa"
      );
    });

    it("should preserve query params when redirecting legacy /beaches/usa URLs", async () => {
      const request = createMockRequest(
        "/beaches/usa/hi/haleiwa",
        "?utm_source=test"
      );

      const response = await middleware(request);

      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/hi/haleiwa?utm_source=test"
      );
    });

    it("should rewrite /{state}/{city} to /beaches/usa/{state}/{city}", async () => {
      const request = createMockRequest("/hi/haleiwa");

      const response = await middleware(request);

      // Short city URLs are served via internal rewrite (no visible redirect)
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-middleware-rewrite")).toContain(
        "/beaches/usa/hi/haleiwa"
      );
    });

    it("should 301 redirect /beaches/{country}/{state}/{city} to /{country}/{state}/{city} for international", async () => {
      const request = createMockRequest("/beaches/mexico/baja-california/rosarito");

      const response = await middleware(request);

      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/mexico/baja-california/rosarito"
      );
    });

    it("should rewrite /{country}/{state}/{city} to /beaches/{country}/{state}/{city} for international", async () => {
      const request = createMockRequest("/mexico/baja-california/rosarito");

      const response = await middleware(request);

      // Short international city URLs are served via internal rewrite (no visible redirect)
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-middleware-rewrite")).toContain(
        "/beaches/mexico/baja-california/rosarito"
      );
    });

    it("should return a real 404/noindex for an invalid international route", async () => {
      const request = createMockRequest("/baja-california/rosarito/k-38");

      const response = await middleware(request);

      expect(response.status).toBe(404);
      expect(response.headers.get("x-robots-tag")).toBe("noindex, follow");
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    });

    it("should preserve the international city rewrite for HEAD requests", async () => {
      const request = createMockRequest("/mexico/baja-california/rosarito");
      request.method = "HEAD";

      const response = await middleware(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-middleware-rewrite")).toContain(
        "/beaches/mexico/baja-california/rosarito",
      );
    });

    it("should not rewrite partner flyer URLs as international city pages", async () => {
      const request = createMockRequest("/p/SURF12/flyer");

      const response = await middleware(request);

      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
      expect(response.headers.get("location")).toBeNull();
      expect(response.status).not.toBe(301);
    });

    it("should not rewrite 4-segment international beach URLs", async () => {
      const request = createMockRequest("/mexico/baja-california/rosarito/teresas");

      const response = await middleware(request);

      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
      expect(response.status).not.toBe(301);
    });
  });

  describe("Canonicalization Matrix (SEO safety net)", () => {
    it("should 308 redirect state-root casing /CA -> /ca", async () => {
      const request = createMockRequest("/CA");

      const response = await middleware(request);

      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe("http://localhost:3000/ca");
    });

    it("should normalize /beaches/us/CA/San-Diego -> /ca/san-diego (301)", async () => {
      const request = createMockRequest("/beaches/us/CA/San-Diego");

      const response = await middleware(request);

      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/ca/san-diego"
      );
    });

    it("should disambiguate HI Waimea short URL /hi/waimea -> /hi/waimea-kauai (301)", async () => {
      const request = createMockRequest("/hi/waimea");

      const response = await middleware(request);

      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/hi/waimea-kauai"
      );
    });

    it("should disambiguate HI Waimea canonical URL /beaches/usa/hi/waimea -> /hi/waimea-kauai (301)", async () => {
      const request = createMockRequest("/beaches/usa/hi/waimea");

      const response = await middleware(request);

      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/hi/waimea-kauai"
      );
    });
  });

  describe("Protected Route Access", () => {
    it("should redirect unauthenticated users to sign-in", async () => {
      mockAuthValidator.validateAuth.mockResolvedValue({
        authenticated: false,
        error: "No session",
      });

      const request = createMockRequest("/profile");

      const response = await middleware(request);

      expect(response.status).toBe(307); // Redirect
      const location = response.headers.get("location");
      expect(location).toContain("/auth/sign-in");
      expect(location).toContain("redirectTo=%2Fprofile");
    });

    it("should allow authenticated users to access protected routes", async () => {
      mockAuthValidator.validateAuth.mockResolvedValue({
        authenticated: true,
        user: {
          id: "user-123",
          email: "user@example.com",
        } as any,
      });

      const request = createMockRequest("/profile");

      const response = await middleware(request);

      expect(response.status).not.toBe(307);
      expect(mockAuthValidator.validateAuth).toHaveBeenCalled();
    });

    it("should preserve query parameters in redirects", async () => {
      mockAuthValidator.validateAuth.mockResolvedValue({
        authenticated: false,
        error: "No session",
      });

      // This should be a public route, so adjust test
      const protectedRequest = createMockRequest("/profile", "?setting=notifications");

      const response = await middleware(protectedRequest);

      const location = response.headers.get("location");
      expect(location).toContain("redirectTo=%2Fprofile%3Fsetting%3Dnotifications");
    });
  });

  describe("Admin Route Access", () => {
    it("should redirect non-admin authenticated users", async () => {
      mockAuthValidator.validateAuth.mockResolvedValue({
        authenticated: true,
        user: {
          id: "regular-user",
          email: "user@example.com",
        } as any,
      });

      mockAdminChecker.checkAdminStatus.mockReturnValue({
        isAdmin: false,
        userId: "regular-user",
        reason: "No admin privileges",
      });

      const request = createMockRequest("/admin");

      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/");
    });

    it("should allow admin users to access admin routes", async () => {
      mockAuthValidator.validateAuth.mockResolvedValue({
        authenticated: true,
        user: {
          id: "bcdc5d59-2e22-4006-98a6-cada8618577a",
          email: "admin@quiver.surf",
        } as any,
      });

      mockAdminChecker.checkAdminStatus.mockReturnValue({
        isAdmin: true,
        userId: "bcdc5d59-2e22-4006-98a6-cada8618577a",
        reason: "Canonical admin user ID",
      });

      const request = createMockRequest("/admin/users");

      const response = await middleware(request);

      expect(response.status).not.toBe(307);
      expect(mockAuthValidator.validateAuth).toHaveBeenCalled();
      expect(mockAdminChecker.checkAdminStatus).toHaveBeenCalled();
    });

    it("should redirect unauthenticated users from admin routes", async () => {
      mockAuthValidator.validateAuth.mockResolvedValue({
        authenticated: false,
        error: "No session",
      });

      const request = createMockRequest("/admin");

      const response = await middleware(request);

      expect(response.status).toBe(307);
      const location = response.headers.get("location");
      expect(location).toContain("/auth/sign-in");
      expect(mockAdminChecker.checkAdminStatus).not.toHaveBeenCalled();
    });
  });

  describe("Skip Routes", () => {
    it("should skip middleware for API routes", async () => {
      const request = createMockRequest("/api/beaches");

      const response = await middleware(request);

      expect(mockAuthValidator.validateAuth).not.toHaveBeenCalled();
      expect(response.status).not.toBe(307);
    });

    it("should skip middleware for static files", async () => {
      const staticFiles = [
        "/_next/static/chunk.js",
        "/favicon.ico",
        "/logo.png",
        "/styles.css",
        "/images/landing/swell-view-preview-v2.png",
        "/images/quiver-stickers/orange-tape.png",
        "/fonts/SpaceGrotesk/SpaceGrotesk-Bold.ttf",
      ];

      for (const path of staticFiles) {
        const request = createMockRequest(path);

        const response = await middleware(request);
        expect(mockAuthValidator.validateAuth).not.toHaveBeenCalled();
        expect(response.status).toBe(200);
        expect(response.headers.get("x-middleware-rewrite")).toBeNull();
        expect(response.headers.get("location")).toBeNull();
      }
    });

    it("should skip middleware for auth routes", async () => {
      const authRoutes = ["/auth/sign-in", "/auth/sign-up", "/auth/callback"];

      for (const path of authRoutes) {
        const request = createMockRequest(path);

        const response = await middleware(request);
        expect(mockAuthValidator.validateAuth).not.toHaveBeenCalled();
      }
    });

    it("should skip middleware for non-GET requests", async () => {
      const methods = ["POST", "PUT", "DELETE", "PATCH"];

      for (const method of methods) {
        const request: any = {
          ...createMockRequest("/any-path"),
          method,
        };

        const response = await middleware(request);
        expect(mockAuthValidator.validateAuth).not.toHaveBeenCalled();
      }
    });
  });

  describe("Security Headers", () => {
    it("should apply security headers to all responses", async () => {
      const paths = ["/", "/map", "/profile", "/admin"];

      // Mock auth for protected/admin paths
      mockAuthValidator.validateAuth.mockResolvedValue({
        authenticated: true,
        user: { id: "bcdc5d59-2e22-4006-98a6-cada8618577a" } as any,
      });

      mockAdminChecker.checkAdminStatus.mockReturnValue({
        isAdmin: true,
        userId: "bcdc5d59-2e22-4006-98a6-cada8618577a",
      });

      for (const path of paths) {
        const request = createMockRequest(path);

        const response = await middleware(request);

        expect(response.headers.get("X-Frame-Options")).toBe("DENY");
        expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle shared session URLs as public", async () => {
      // /sessions/:id should be public (shareable)
      const request = createMockRequest("/sessions/abc-123-shared");

      const response = await middleware(request);

      expect(mockAuthValidator.validateAuth).not.toHaveBeenCalled();
      expect(response.status).not.toBe(307);
    });

    it("should require auth for creating new sessions", async () => {
      mockAuthValidator.validateAuth.mockResolvedValue({
        authenticated: false,
        error: "No session",
      });

      const request = createMockRequest("/sessions/new");

      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/auth/sign-in");
    });

    it("should handle paths with trailing slashes", async () => {
      mockAuthValidator.validateAuth.mockResolvedValue({
        authenticated: true,
        user: { id: "user-123" } as any,
      });

      const withSlash = createMockRequest("/profile/");

      const response = await middleware(withSlash);
      expect(response.status).not.toBe(307);
    });
  });
});
