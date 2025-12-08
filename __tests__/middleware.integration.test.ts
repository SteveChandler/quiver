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
import { middleware } from "@/middleware";

// Mock dependencies
jest.mock("@/lib/api-utils", () => ({
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

import { AuthValidator } from "@/lib/middleware/auth-validator";
import { RouteGuard } from "@/lib/middleware/route-guard";
import { AdminChecker } from "@/lib/middleware/admin-checker";

describe("Middleware Integration Tests", () => {
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
      },
      url,
      method: "GET",
      headers: new Headers(),
      cookies: {
        get: jest.fn(() => undefined),
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
            set: jest.fn(),
            delete: jest.fn(),
          },
        };

        const response = await middleware(request);

        expect(response.status).not.toBe(307); // Not redirected
        expect(mockAuthValidator.validateAuth).not.toHaveBeenCalled();
      }
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
          set: jest.fn(),
          delete: jest.fn(),
        },
      };

      const response = await middleware(request);

      expect(response.headers.get("X-Frame-Options")).toBe("DENY");
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
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
      ];

      for (const path of staticFiles) {
        const request = createMockRequest(path);

        const response = await middleware(request);
        expect(mockAuthValidator.validateAuth).not.toHaveBeenCalled();
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
