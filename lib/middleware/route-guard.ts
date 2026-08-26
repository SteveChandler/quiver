/**
 * RouteGuard - Handles route classification and access control
 *
 * Responsibilities:
 * - Classify routes (public, protected, admin)
 * - Determine if authentication is required
 * - Filter out non-page requests (API, static files, etc.)
 *
 * Design Pattern: Guard Pattern
 * - Encapsulates route protection logic
 * - Single source of truth for route configuration
 * - Simplifies middleware routing decisions
 */

export type RouteType = "public" | "protected" | "admin" | "skip";

export interface RouteClassification {
  type: RouteType;
  requiresAuth: boolean;
  requiresAdmin: boolean;
}

export class RouteGuard {
  private static readonly STATIC_ASSET_PATH_PATTERN = /\.[^/]+$/;
  private static readonly PUBLIC_PROFILE_PATH_PATTERN =
    /^\/profile\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/?$/i;

  // Define paths that require authentication
  // Note: /forecast, /beach, /map are now public for SEO and user acquisition
  // /sessions/new requires auth to create sessions, but /sessions/:id is public for sharing
  private static readonly PROTECTED_PATHS = [
    "/profile",
    "/alerts",
    "/dashboard",
    "/journal",
    "/discover",
    "/sessions/new",
    "/settings",
  ];

  // Admin-only paths require additional authorization
  private static readonly ADMIN_PATHS = ["/admin"];

  // Paths to skip middleware processing entirely
  private static readonly SKIP_PATTERNS = [
    "/api/",
    "/_next/",
    "/favicon.ico",
    "/auth/",
    "/error",
  ];

  /**
   * Classify a route based on its pathname
   * Returns the route type and required access levels
   */
  static classifyRoute(pathname: string, method: string): RouteClassification {
    // HEAD must follow GET routing so canonical rewrites resolve identically.
    if (method !== "GET" && method !== "HEAD") {
      return {
        type: "skip",
        requiresAuth: false,
        requiresAdmin: false,
      };
    }

    // Skip middleware for API routes, static files, auth routes
    if (this.shouldSkipRoute(pathname)) {
      return {
        type: "skip",
        requiresAuth: false,
        requiresAdmin: false,
      };
    }

    // Check if route is admin-only
    if (this.isAdminRoute(pathname)) {
      return {
        type: "admin",
        requiresAuth: true,
        requiresAdmin: true,
      };
    }

    if (this.PUBLIC_PROFILE_PATH_PATTERN.test(pathname)) {
      return {
        type: "public",
        requiresAuth: false,
        requiresAdmin: false,
      };
    }

    // Check if route is protected (requires auth but not admin)
    if (this.isProtectedRoute(pathname)) {
      return {
        type: "protected",
        requiresAuth: true,
        requiresAdmin: false,
      };
    }

    // Default: public route
    return {
      type: "public",
      requiresAuth: false,
      requiresAdmin: false,
    };
  }

  /**
   * Check if middleware should skip processing this route
   */
  private static shouldSkipRoute(pathname: string): boolean {
    // Check against skip patterns
    if (this.SKIP_PATTERNS.some((pattern) => pathname.startsWith(pattern))) {
      return true;
    }

    // Skip any file with an extension (images, fonts, etc.)
    if (this.isStaticAssetPath(pathname)) {
      return true;
    }

    return false;
  }

  static isStaticAssetPath(pathname: string): boolean {
    return this.STATIC_ASSET_PATH_PATTERN.test(pathname);
  }

  /**
   * Check if route requires authentication (protected or admin)
   */
  private static isProtectedRoute(pathname: string): boolean {
    return this.PROTECTED_PATHS.some((path) => pathname.startsWith(path));
  }

  /**
   * Check if route requires admin privileges
   */
  private static isAdminRoute(pathname: string): boolean {
    return this.ADMIN_PATHS.some((path) => pathname.startsWith(path));
  }

  /**
   * Get a human-readable description of route type
   */
  static describeRoute(classification: RouteClassification): string {
    switch (classification.type) {
      case "skip":
        return "Skipped (API/static/auth)";
      case "admin":
        return "Admin-only route";
      case "protected":
        return "Protected route (auth required)";
      case "public":
        return "Public route";
      default:
        return "Unknown route type";
    }
  }

  /**
   * Build a sign-in redirect URL with preserved query parameters
   */
  static buildSignInRedirect(
    pathname: string,
    searchParams: string,
    baseUrl: string
  ): URL {
    const signInUrl = new URL("/auth/sign-in", baseUrl);

    // Preserve query parameters in redirectTo
    const redirectPath = searchParams
      ? `${pathname}${searchParams}`
      : pathname;

    signInUrl.searchParams.set("redirectTo", redirectPath);

    return signInUrl;
  }

  /**
   * Build an unauthorized redirect URL (for non-admin users accessing admin routes)
   */
  static buildUnauthorizedRedirect(baseUrl: string): URL {
    return new URL("/", baseUrl);
  }
}
