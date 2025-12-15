import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_SECURITY_HEADERS } from "@/lib/api-utils";
import { AuthValidator } from "@/lib/middleware/auth-validator";
import { RouteGuard } from "@/lib/middleware/route-guard";
import { AdminChecker } from "@/lib/middleware/admin-checker";
import { isValidStateSlug } from "@/lib/utils/beach-url-utils";
import {
  parseUTMParams,
  parseAttributionFromRequestCookies,
  generateAttributionCookieHeaders,
  type AttributionData,
} from "@/lib/attribution";

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

  // Legacy California city route redirect
  // Redirect /ca/san-diego and /ca/orange-county to new /beaches/usa/ca/* routes
  const legacyCaMatch = pathname.match(/^\/ca\/(san-diego|orange-county)$/);
  if (legacyCaMatch) {
    const city = legacyCaMatch[1];
    return NextResponse.redirect(
      new URL(`/beaches/usa/ca/${city}`, request.url),
      { status: 301 }
    );
  }

  // Location page shortcut redirect
  // Redirect /beaches/ca/san-diego -> /beaches/usa/ca/san-diego
  const beachesStateCityMatch = pathname.match(/^\/beaches\/([^/]+)\/([^/]+)$/);
  if (beachesStateCityMatch) {
    const state = beachesStateCityMatch[1]?.toLowerCase() || "";
    const city = beachesStateCityMatch[2]?.toLowerCase() || "";

    if (isValidStateSlug(state)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = `/beaches/usa/${state}/${city}`;
      return NextResponse.redirect(redirectUrl, { status: 308 });
    }
  }

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
 * Create a NextResponse with security headers and attribution cookies
 */
function createSecureResponse(request: NextRequest): NextResponse {
  // Add pathname to request headers for server components to access
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Add security headers to all responses
  Object.entries(DEFAULT_SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value as string);
  });

  // Capture UTM attribution parameters
  captureAttributionParams(request, response);

  return response;
}

/**
 * Capture UTM parameters and referrer for attribution tracking
 * Uses first-touch model - only sets cookies if not already present
 */
function captureAttributionParams(
  request: NextRequest,
  response: NextResponse
): void {
  try {
    const { searchParams } = request.nextUrl;

    // Parse UTM params from URL
    const utmParams = parseUTMParams(searchParams);

    // Check if we have any UTM params to capture
    const hasUtmParams = Object.values(utmParams).some((v) => v != null);

    // Get referrer from headers (external referrers only)
    const referrer = request.headers.get("referer") || null;
    const host = request.headers.get("host") || "";
    const isExternalReferrer = referrer && !referrer.includes(host);

    // If no attribution data to capture, skip
    if (!hasUtmParams && !isExternalReferrer) {
      return;
    }

    // Get existing attribution from cookies
    const cookieHeader = request.headers.get("cookie");
    const existingAttribution = parseAttributionFromRequestCookies(cookieHeader);

    // Build new attribution data
    const newAttribution: Partial<AttributionData> = {
      ...utmParams,
    };

    // Add referrer if external
    if (isExternalReferrer) {
      newAttribution.referrer = referrer;
    }

    // First touch tracking
    if (!existingAttribution.first_touch_ts) {
      newAttribution.first_touch_ts = new Date().toISOString();
      newAttribution.landing_page =
        request.nextUrl.pathname + request.nextUrl.search;
    }

    // Generate and set cookie headers (first-touch model)
    const cookieHeaders = generateAttributionCookieHeaders(
      newAttribution,
      existingAttribution
    );

    for (const cookieHeader of cookieHeaders) {
      response.headers.append("Set-Cookie", cookieHeader);
    }

    if (isDev && isVerbose && cookieHeaders.length > 0) {
      log(`[Middleware] Attribution captured: ${cookieHeaders.length} cookies set`);
    }
  } catch (error) {
    // Don't let attribution errors break the middleware
    if (isDev) {
      console.warn("[Middleware] Attribution capture error:", error);
    }
  }
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
