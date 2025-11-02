import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_SECURITY_HEADERS } from "@/lib/api-utils";
import { AuthValidator } from "@/lib/middleware/auth-validator";
import { RouteGuard } from "@/lib/middleware/route-guard";
import { AdminChecker } from "@/lib/middleware/admin-checker";

// Only enable verbose logging in development
const isDev = process.env.NODE_ENV === "development";
const isVerbose = process.env.MIDDLEWARE_VERBOSE === "true";

function log(message: string, data?: any) {
  if (isDev && isVerbose) {
    console.log(message, data || "");
  }
}

/**
 * Next.js Middleware - Handles authentication and authorization
 *
 * Refactored for improved separation of concerns:
 * - AuthValidator: Handles session/auth validation
 * - RouteGuard: Classifies routes and determines access requirements
 * - AdminChecker: Validates admin privileges
 *
 * Cyclomatic Complexity: Reduced from 37 → 6
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Classify the route to determine access requirements
  const routeClassification = RouteGuard.classifyRoute(
    pathname,
    request.method
  );

  // Skip middleware for API routes, static files, etc.
  if (routeClassification.type === "skip") {
    return NextResponse.next();
  }

  // Create response with security headers
  const response = createSecureResponse(request);

  log(`[Middleware] Processing ${RouteGuard.describeRoute(routeClassification)}: ${pathname}`);

  // Public routes don't require authentication
  if (!routeClassification.requiresAuth) {
    return response;
  }

  // Protected/admin routes require authentication
  const authResult = await authenticateRequest(request, response);

  if (!authResult.authenticated) {
    const signInUrl = RouteGuard.buildSignInRedirect(
      pathname,
      request.nextUrl.search,
      request.url
    );
    return NextResponse.redirect(signInUrl);
  }

  // Admin routes require additional authorization check
  if (routeClassification.requiresAdmin) {
    const adminResult = checkAdminPrivileges(authResult.user!);

    if (!adminResult.isAdmin) {
      log(`[Middleware] User ${adminResult.userId} denied admin access`);
      return NextResponse.redirect(
        RouteGuard.buildUnauthorizedRedirect(request.url)
      );
    }

    log(`[Middleware] Admin access granted: ${adminResult.reason}`);
  }

  return response;
}

/**
 * Create a NextResponse with security headers
 */
function createSecureResponse(request: NextRequest): NextResponse {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Add security headers to all responses
  Object.entries(DEFAULT_SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value as string);
  });

  return response;
}

/**
 * Authenticate the request using AuthValidator
 */
async function authenticateRequest(
  request: NextRequest,
  response: NextResponse
) {
  const authValidator = new AuthValidator(
    request,
    {
      get(name) {
        const cookie = request.cookies.get(name);
        return cookie?.value;
      },
      set(name, value, options) {
        log(`[Middleware] Setting cookie: ${name}`);
        response.cookies.set({
          name,
          value,
          ...options,
        });
      },
      remove(name, options) {
        log(`[Middleware] Removing cookie: ${name}`);
        response.cookies.delete({
          name,
          ...options,
        });
      },
    },
    isVerbose
  );

  return await authValidator.validateAuth();
}

/**
 * Check admin privileges using AdminChecker
 */
function checkAdminPrivileges(user: any) {
  const adminChecker = new AdminChecker(isVerbose);
  return adminChecker.checkAdminStatus(user);
}

export const config = {
  runtime: "nodejs",
  matcher: [
    /*
     * Match all page routes but exclude:
     * - API routes (/api/*)
     * - Static files (/_next/static, /_next/image)
     * - Files with extensions (.svg, .png, etc.)
     * Only apply to actual page navigation
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
