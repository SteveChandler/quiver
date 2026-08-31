/**
 * RouteGuard Unit Tests
 *
 * Tests route classification and access control logic including:
 * - Public route detection
 * - Protected route detection
 * - Admin route detection
 * - Skip pattern matching
 * - Redirect URL construction
 */

import { RouteGuard, type RouteType } from "@/lib/middleware/route-guard";

describe("RouteGuard", () => {
  describe("classifyRoute", () => {
    describe("Skip Routes", () => {
      it("should skip API routes", () => {
        const result = RouteGuard.classifyRoute("/api/users", "GET");
        expect(result.type).toBe("skip");
        expect(result.requiresAuth).toBe(false);
        expect(result.requiresAdmin).toBe(false);
      });

      it("should skip Next.js internal routes", () => {
        const result = RouteGuard.classifyRoute("/_next/static/chunk.js", "GET");
        expect(result.type).toBe("skip");
        expect(result.requiresAuth).toBe(false);
      });

      it("should skip favicon", () => {
        const result = RouteGuard.classifyRoute("/favicon.ico", "GET");
        expect(result.type).toBe("skip");
      });

      it("should skip auth routes", () => {
        const result = RouteGuard.classifyRoute("/auth/sign-in", "GET");
        expect(result.type).toBe("skip");
      });

      it("should skip error routes", () => {
        const result = RouteGuard.classifyRoute("/error", "GET");
        expect(result.type).toBe("skip");
      });

      it("should skip files with extensions", () => {
        expect(RouteGuard.classifyRoute("/logo.png", "GET").type).toBe("skip");
        expect(RouteGuard.classifyRoute("/styles.css", "GET").type).toBe("skip");
        expect(RouteGuard.classifyRoute("/app.js", "GET").type).toBe("skip");
      });

      it("should not skip routes with dots outside the final segment", () => {
        const result = RouteGuard.classifyRoute(
          "/profile/jane.doe/settings",
          "GET",
        );

        expect(result.type).toBe("protected");
        expect(result.requiresAuth).toBe(true);
      });

      it("should skip non-GET requests", () => {
        const result = RouteGuard.classifyRoute("/profile", "POST");
        expect(result.type).toBe("skip");
        expect(result.requiresAuth).toBe(false);
      });

      it("should process HEAD requests like GET requests", () => {
        const result = RouteGuard.classifyRoute(
          "/mexico/baja-california/rosarito",
          "HEAD",
        );

        expect(result.type).toBe("public");
        expect(result.requiresAuth).toBe(false);
        expect(result.requiresAdmin).toBe(false);
      });

      it("should process POST to valid paths as skip", () => {
        const methods = ["POST", "PUT", "DELETE", "PATCH"];
        methods.forEach((method) => {
          const result = RouteGuard.classifyRoute("/any-path", method);
          expect(result.type).toBe("skip");
        });
      });
    });

    describe("Admin Routes", () => {
      it("should classify /admin as admin route", () => {
        const result = RouteGuard.classifyRoute("/admin", "GET");
        expect(result.type).toBe("admin");
        expect(result.requiresAuth).toBe(true);
        expect(result.requiresAdmin).toBe(true);
      });

      it("should classify /admin/* as admin routes", () => {
        const adminPaths = [
          "/admin/users",
          "/admin/settings",
          "/admin/dashboard",
          "/admin/reports/analytics",
        ];

        adminPaths.forEach((path) => {
          const result = RouteGuard.classifyRoute(path, "GET");
          expect(result.type).toBe("admin");
          expect(result.requiresAuth).toBe(true);
          expect(result.requiresAdmin).toBe(true);
        });
      });
    });

    describe("Protected Routes", () => {
      it("should classify protected routes correctly", () => {
        const protectedPaths = [
          "/profile",
          "/dashboard",
          "/journal",
          "/discover",
          "/sessions/new",
        ];

        protectedPaths.forEach((path) => {
          const result = RouteGuard.classifyRoute(path, "GET");
          expect(result.type).toBe("protected");
          expect(result.requiresAuth).toBe(true);
          expect(result.requiresAdmin).toBe(false);
        });
      });

      it("should classify nested protected routes", () => {
        const result = RouteGuard.classifyRoute("/profile/edit", "GET");
        expect(result.type).toBe("protected");
        expect(result.requiresAuth).toBe(true);
      });

      it("keeps non-profile-id account paths protected", () => {
        for (const path of ["/profile/edit", "/profile/analytics", "/profile/not-a-user-id"]) {
          const result = RouteGuard.classifyRoute(path, "GET");
          expect(result.type).toBe("protected");
          expect(result.requiresAuth).toBe(true);
        }
      });
    });

    describe("Public Routes", () => {
      it("should classify public routes correctly", () => {
        const publicPaths = [
          "/",
          "/map",
          "/beach/123",
          "/forecast",
          "/sessions/abc-123", // Shared session URL
          "/about",
        ];

        publicPaths.forEach((path) => {
          const result = RouteGuard.classifyRoute(path, "GET");
          expect(result.type).toBe("public");
          expect(result.requiresAuth).toBe(false);
          expect(result.requiresAdmin).toBe(false);
        });
      });

      it("should allow public access to shared sessions", () => {
        // /sessions/new requires auth (create session)
        // /sessions/:id is public (view shared session)
        const newSession = RouteGuard.classifyRoute("/sessions/new", "GET");
        expect(newSession.type).toBe("protected");

        const viewSession = RouteGuard.classifyRoute("/sessions/abc-123", "GET");
        expect(viewSession.type).toBe("public");
      });

      it("allows only UUID profile aliases to render public share metadata", () => {
        const profile = RouteGuard.classifyRoute(
          "/profile/bcacdc51-b01b-4702-ac0b-fb492c0a926a",
          "GET",
        );
        const profileWithSlash = RouteGuard.classifyRoute(
          "/profile/bcacdc51-b01b-4702-ac0b-fb492c0a926a/",
          "HEAD",
        );

        expect(profile).toMatchObject({ type: "public", requiresAuth: false });
        expect(profileWithSlash).toMatchObject({ type: "public", requiresAuth: false });
      });
    });
  });

  describe("describeRoute", () => {
    it("should provide human-readable descriptions", () => {
      const skip = RouteGuard.classifyRoute("/api/test", "GET");
      expect(RouteGuard.describeRoute(skip)).toBe("Skipped (API/static/auth)");

      const admin = RouteGuard.classifyRoute("/admin", "GET");
      expect(RouteGuard.describeRoute(admin)).toBe("Admin-only route");

      const protected_ = RouteGuard.classifyRoute("/profile", "GET");
      expect(RouteGuard.describeRoute(protected_)).toBe(
        "Protected route (auth required)"
      );

      const public_ = RouteGuard.classifyRoute("/map", "GET");
      expect(RouteGuard.describeRoute(public_)).toBe("Public route");
    });
  });

  describe("buildSignInRedirect", () => {
    it("should build sign-in URL with redirect path", () => {
      const url = RouteGuard.buildSignInRedirect(
        "/profile",
        "",
        "http://localhost:3000"
      );

      expect(url.pathname).toBe("/auth/sign-in");
      expect(url.searchParams.get("redirectTo")).toBe("/profile");
    });

    it("should preserve query parameters in redirect", () => {
      const url = RouteGuard.buildSignInRedirect(
        "/beach/123",
        "?tab=forecast&date=2024-01-15",
        "http://localhost:3000"
      );

      expect(url.pathname).toBe("/auth/sign-in");
      expect(url.searchParams.get("redirectTo")).toBe(
        "/beach/123?tab=forecast&date=2024-01-15"
      );
    });

    it("should handle paths without query params", () => {
      const url = RouteGuard.buildSignInRedirect(
        "/dashboard",
        "",
        "http://localhost:3000"
      );

      expect(url.searchParams.get("redirectTo")).toBe("/dashboard");
    });

    it("should work with different base URLs", () => {
      const url = RouteGuard.buildSignInRedirect(
        "/profile",
        "",
        "https://www.quiversurf.app"
      );

      expect(url.origin).toBe("https://www.quiversurf.app");
      expect(url.pathname).toBe("/auth/sign-in");
    });
  });

  describe("buildUnauthorizedRedirect", () => {
    it("should redirect to home page", () => {
      const url = RouteGuard.buildUnauthorizedRedirect("http://localhost:3000");

      expect(url.pathname).toBe("/");
      expect(Array.from(url.searchParams.keys())).toHaveLength(0);
    });

    it("should work with different base URLs", () => {
      const url = RouteGuard.buildUnauthorizedRedirect(
        "https://www.quiversurf.app"
      );

      expect(url.origin).toBe("https://www.quiversurf.app");
      expect(url.pathname).toBe("/");
    });
  });

  describe("Edge Cases", () => {
    it("should handle trailing slashes consistently", () => {
      const withSlash = RouteGuard.classifyRoute("/profile/", "GET");
      const withoutSlash = RouteGuard.classifyRoute("/profile", "GET");

      expect(withSlash.type).toBe(withoutSlash.type);
      expect(withSlash.requiresAuth).toBe(withoutSlash.requiresAuth);
    });

    it("should handle case sensitivity", () => {
      // Paths are case-sensitive by default
      const lowercase = RouteGuard.classifyRoute("/profile", "GET");
      const uppercase = RouteGuard.classifyRoute("/PROFILE", "GET");

      // /PROFILE doesn't match /profile pattern, so it's public
      expect(lowercase.type).toBe("protected");
      expect(uppercase.type).toBe("public");
    });

    it("should handle deep nested paths", () => {
      const deepAdmin = RouteGuard.classifyRoute(
        "/admin/users/123/settings/advanced",
        "GET"
      );
      expect(deepAdmin.type).toBe("admin");

      const deepProtected = RouteGuard.classifyRoute(
        "/profile/settings/privacy/data",
        "GET"
      );
      expect(deepProtected.type).toBe("protected");
    });

    it("should handle special characters in paths", () => {
      const encoded = RouteGuard.classifyRoute(
        "/beach/Santa%20Cruz%20Main",
        "GET"
      );
      expect(encoded.type).toBe("public");
    });
  });
});
