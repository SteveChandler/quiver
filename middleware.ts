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
import {
  extractIPLocation,
  serializeIPLocation,
  getIPLocationCookieName,
} from "@/lib/location/ip-location";

// Only enable verbose logging in development
const isDev = process.env.NODE_ENV === "development";
const isVerbose = process.env.MIDDLEWARE_VERBOSE === "true";

function log(message: string, data?: any) {
  if (isDev && isVerbose) {
    console.warn(message, data || "");
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

  /**
   * Hawaii: disambiguate same-named cities by island (Waimea-only to start)
   *
   * Redirect ambiguous legacy URL to the primary island page.
   */
  if (pathname === "/hi/waimea") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/hi/waimea-kauai";
    return NextResponse.redirect(redirectUrl, { status: 301 });
  }

  /**
   * Garbage URL cleanup
   * Search Console can surface odd one-off crawls like `/$` (sometimes encoded as `/%24`).
   * We permanently redirect these to the homepage.
   */
  if (pathname === "/$" || pathname === "/%24") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    return NextResponse.redirect(redirectUrl, { status: 308 });
  }

  /**
   * Canonical slug redirects for cities with diacritics
   *
   * The slugify() function strips non-ASCII characters, producing malformed slugs
   * like "rinc-n" from "Rincón". We redirect these to the correct canonical slug.
   */
  if (pathname === "/pr/rinc-n") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/pr/rincon";
    return NextResponse.redirect(redirectUrl, { status: 301 });
  }

  /**
   * Canonicalize state-root casing
   * Example: /CA -> /ca
   *
   * We do this in middleware so the canonical redirect happens before any route
   * handling, and so it works even when the underlying page is ISR/static.
   */
  const stateRootMatch = pathname.match(/^\/([A-Za-z]{2})$/);
  if (stateRootMatch) {
    const raw = stateRootMatch[1] || "";
    const lower = raw.toLowerCase();

    if (raw !== lower) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = `/${lower}`;
      return NextResponse.redirect(redirectUrl, { status: 308 });
    }
  }

  /**
   * Canonical city pages (SEO)
   *
   * Canonical (USA):  /beaches/usa/{state}/{city}
   * Canonical (Intl): /beaches/{country}/{state}/{city}
   *
   * Legacy:
   * - /{state}/{city}
   * - /{country}/{state}/{city}
   * - /beaches/{state}/{city}
   *
   * We keep the legacy URLs working via a 301 to the canonical.
   */

  // Canonicalize /beaches/{country}/{state}/{city} slugs (lowercase + "usa" normalization)
  const legacyLocationMatch = pathname.match(
    /^\/beaches\/([^/]+)\/([^/]+)\/([^/]+)$/
  );
  if (legacyLocationMatch) {
    const country = legacyLocationMatch[1]?.toLowerCase() || "";
    const state = legacyLocationMatch[2]?.toLowerCase() || "";
    const city = legacyLocationMatch[3]?.toLowerCase() || "";

    // Special-case HI ambiguous city slugs to avoid redirect chains.
    if (country === "usa" && state === "hi" && city === "waimea") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/beaches/usa/hi/waimea-kauai";
      return NextResponse.redirect(redirectUrl, { status: 301 });
    }

    const canonicalCountry = country === "us" ? "usa" : country;
    const canonicalPath = `/beaches/${canonicalCountry}/${state}/${city}`;

    // Avoid redirect loops: only redirect when normalization changes the path.
    if (pathname !== canonicalPath) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = canonicalPath;
      return NextResponse.redirect(redirectUrl, { status: 301 });
    }
  }

  // Legacy shortcut redirect (no country segment)
  // Redirect /beaches/ca/san-diego -> /beaches/usa/ca/san-diego
  const beachesStateCityMatch = pathname.match(/^\/beaches\/([^/]+)\/([^/]+)$/);
  if (beachesStateCityMatch) {
    const state = beachesStateCityMatch[1]?.toLowerCase() || "";
    const city = beachesStateCityMatch[2]?.toLowerCase() || "";

    if (isValidStateSlug(state)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = `/beaches/usa/${state}/${city}`;
      return NextResponse.redirect(redirectUrl, { status: 301 });
    }
  }

  // (Legacy /beaches/{country}/{state}/{city} normalization handled above.)

  // Redirect legacy international beach URLs (if any) to canonical short
  // Example: /beaches/mexico/baja-california/rosarito/teresas -> /mexico/baja-california/rosarito/teresas
  const legacyInternationalBeachMatch = pathname.match(
    /^\/beaches\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)$/
  );
  if (legacyInternationalBeachMatch) {
    const country = legacyInternationalBeachMatch[1]?.toLowerCase() || "";
    const state = legacyInternationalBeachMatch[2]?.toLowerCase() || "";
    const city = legacyInternationalBeachMatch[3]?.toLowerCase() || "";
    const beachSlug = legacyInternationalBeachMatch[4] || "";

    const redirectUrl = request.nextUrl.clone();
    if (country === "usa" || country === "us") {
      redirectUrl.pathname = `/${state}/${city}/${beachSlug}`;
    } else {
      redirectUrl.pathname = `/${country}/${state}/${city}/${beachSlug}`;
    }
    return NextResponse.redirect(redirectUrl, { status: 301 });
  }

  // Rewrite canonical short city URLs to the existing location page route
  // Example: /hi/haleiwa -> 301 to /beaches/usa/hi/haleiwa
  const canonicalCityMatch = pathname.match(/^\/([^/]+)\/([^/]+)$/);
  if (canonicalCityMatch) {
    const state = canonicalCityMatch[1]?.toLowerCase() || "";
    const city = canonicalCityMatch[2]?.toLowerCase() || "";

    if (isValidStateSlug(state)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = `/beaches/usa/${state}/${city}`;
      return NextResponse.redirect(redirectUrl, { status: 301 });
    }
  }

  // Rewrite canonical short international city URLs to the existing location page route
  // Example: /mexico/baja-california/rosarito -> 301 to /beaches/mexico/baja-california/rosarito
  const canonicalInternationalCityMatch = pathname.match(
    /^\/([^/]+)\/([^/]+)\/([^/]+)$/
  );
  if (canonicalInternationalCityMatch) {
    const country = canonicalInternationalCityMatch[1]?.toLowerCase() || "";
    const state = canonicalInternationalCityMatch[2]?.toLowerCase() || "";
    const city = canonicalInternationalCityMatch[3]?.toLowerCase() || "";

    // Avoid rewriting US beach detail URLs (/ca/san-diego/ocean-beach, etc.)
    if (isValidStateSlug(country)) {
      // country segment is actually a state slug; let the beach route handle it
      // (or fall through to normal routing).
    } else {
      // Avoid rewriting other first-party routes that also have 3 segments.
      const reserved = new Set([
        "api",
        "_next",
        "auth",
        "admin",
        "beach",
        "beaches",
        "discover",
        "features",
        "forecast",
        "inbox",
        "journal",
        "map",
        "privacy",
        "profile",
        "sessions",
        "share",
        "spots",
        "s",
        "user",
        "error",
        ".well-known",
      ]);

      if (!reserved.has(country)) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = `/beaches/${country}/${state}/${city}`;
        return NextResponse.redirect(redirectUrl, { status: 301 });
      }
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

  // Capture IP-based location for dynamic content
  captureIPLocation(request, response);

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
 * Capture IP-based location from Vercel geolocation headers.
 * Sets a cookie for client-side access to enable dynamic location display.
 *
 * In production (Vercel), headers like x-vercel-ip-city are populated automatically.
 * In development, uses fallback values for testing.
 */
function captureIPLocation(
  request: NextRequest,
  response: NextResponse
): void {
  try {
    const cookieName = getIPLocationCookieName();

    // Skip if cookie already exists (don't overwrite on every request)
    const existingCookie = request.cookies.get(cookieName);
    if (existingCookie?.value) {
      return;
    }

    // Extract IP location from Vercel headers (or use dev fallback)
    let ipLocation = extractIPLocation(request.headers);

    // In development, use fallback values since Vercel headers aren't available
    if (isDev && !ipLocation.city) {
      ipLocation = {
        city: process.env.DEV_IP_CITY || 'San Diego',
        region: process.env.DEV_IP_REGION || 'CA',
        country: process.env.DEV_IP_COUNTRY || 'US',
        latitude: parseFloat(process.env.DEV_IP_LAT || '32.7157'),
        longitude: parseFloat(process.env.DEV_IP_LON || '-117.1611'),
      };
    }

    // Only set cookie if we have location data
    if (ipLocation.city || ipLocation.latitude) {
      response.cookies.set({
        name: cookieName,
        value: serializeIPLocation(ipLocation),
        httpOnly: false, // Must be readable by client-side JS
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60, // 1 hour - refreshes on each new session
        path: '/',
      });

      log(`[Middleware] IP location captured: ${ipLocation.city}, ${ipLocation.region}`);
    }
  } catch (error) {
    // Don't let IP location errors break the middleware
    if (isDev) {
      console.warn("[Middleware] IP location capture error:", error);
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
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
