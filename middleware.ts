import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SECURITY_HEADERS } from "@/lib/api-utils";
import { AuthValidator } from "@/lib/middleware/auth-validator";
import { RouteGuard } from "@/lib/middleware/route-guard";
import { AdminChecker } from "@/lib/middleware/admin-checker";
import { isValidStateSlug } from "@/lib/utils/beach-url-utils";
import {
  handleSeoRedirect,
  lookupBeachBySlug,
  buildCanonicalBeachUrl,
} from "@/lib/middleware/seo-redirect-handler";
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

// Known beach sub-pages with dedicated routes (e.g., /ca/city/beach/tides)
const BEACH_SUBPATHS = new Set(["tides", "water-temp"]);

// Reserved first-path segments that should NOT be treated as international country slugs
const INTERNATIONAL_RESERVED_SEGMENTS = new Set([
  "api",
  "_next",
  "auth",
  "admin",
  "beach",
  "beaches",
  "discover",
  "embed",
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
  // Intent slugs - prevent /{intent}/{state}/{city} from being treated as international URLs
  "beginner",
  "longboard",
  "tide",
  "water-temp",
  "dawn-patrol",
  "sunset",
  "least-crowded",
]);

// Legacy slug variants that Google indexed but don't match the DB slug.
// Maps old slug → current DB slug so /spots/{old} resolves instead of 404-ing.
// Remove entries after Google drops the cached URLs (~6 months after redirect).
const LEGACY_SPOT_SLUG_ALIASES: Record<string, string> = {
  "blacks-beach": "blacks", // 271 impressions at 0 clicks — added Mar 2026
  "lowers-trestles": "lower-trestles", // plural variant linked from OC surf spots page
};

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

  // Deferred rewrite target for city URLs — set below, applied in createSecureResponse()
  let rewriteTarget: URL | undefined;

  /**
   * Legacy /spots/{slug} → canonical URL redirect (HTTP 301)
   *
   * The spots page component uses permanentRedirect() which Next.js App Router
   * emits as HTTP 308. Intercepting here in middleware allows us to issue the
   * correct HTTP 301 for maximum crawler compatibility.
   *
   * The DB lookup reuses the same lookupBeachBySlug helper used by handleSeoRedirect,
   * so we stay within the established middleware DB access pattern (fetch + short timeout).
   * Only redirects when the beach has complete location data (city + state in DB).
   * If lookup fails or beach lacks location data, the request passes through to the
   * spots page which renders the non-redirect path.
   */
  const spotsMatch = pathname.match(/^\/spots\/([^/]+?)\/?$/);
  if (spotsMatch && spotsMatch[1]) {
    const rawSlug = spotsMatch[1];
    const spotSlug = LEGACY_SPOT_SLUG_ALIASES[rawSlug] ?? rawSlug;
    try {
      const beach = await lookupBeachBySlug(spotSlug);
      if (beach) {
        const canonicalUrl = buildCanonicalBeachUrl(beach);
        if (canonicalUrl && canonicalUrl !== `/spots/${spotSlug}`) {
          // Preserve query parameters (tabs, UTM params, etc.)
          const redirectUrl = request.nextUrl.clone();
          redirectUrl.pathname = canonicalUrl;
          return NextResponse.redirect(redirectUrl, { status: 301 });
        }
      }
    } catch {
      // Fail open: if DB lookup fails, let the spots page handle the request
    }
  }

  /**
   * Handle 4-segment state URLs that would incorrectly match the international route
   *
   * URLs like /hi/koloa-hi/waikoloa-village-lagoon/extra would match the 4-segment
   * international route (/[country]/[region]/[city]/[beach]) but with "hi" as the
   * country. Since "hi" is a valid state slug, redirect to /spots/{beach} instead.
   *
   * This prevents 404s caused by the international route's state slug validation.
   */
  const fourSegmentMatch = pathname.match(/^\/([a-z]{2})\/([^/]+)\/([^/]+)\/([^/]+?)\/?$/i);
  if (fourSegmentMatch && isValidStateSlug(fourSegmentMatch[1].toLowerCase())) {
    const fourthSegment = fourSegmentMatch[4].toLowerCase();
    // Known beach sub-pages with dedicated routes — let these pass through
    if (!BEACH_SUBPATHS.has(fourthSegment)) {
      const beachSlug = fourSegmentMatch[3]; // Use the 3rd segment as beach slug
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = `/spots/${beachSlug}`;
      return NextResponse.redirect(redirectUrl, { status: 301 });
    }
  }

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
   * Legacy redirect: malformed "rinc-n" slugs from old slugify() bug.
   * Root cause fixed in generateLocationSlug() (now uses slugifyAscii).
   * Keep this redirect until Google drops the cached /pr/rinc-n URLs (~Q2 2026).
   */
  if (pathname === "/pr/rinc-n" || pathname.startsWith("/pr/rinc-n/")) {
    const redirectUrl = request.nextUrl.clone();

    // Single-hop redirect for known compound slug → canonical beach URL
    // (avoids 2-hop chain: rinc-n → rincon → canonical)
    const segments = pathname.split("/").filter(Boolean); // ["pr", "rinc-n", "marias-rincon-pr"]
    if (segments.length === 3) {
      const PR_RINCN_CANONICAL: Record<string, string> = {
        // Rincón
        "marias-rincon-pr": "/pr/rincon/marias",
        "domes-rincon-pr": "/pr/rincon/domes",
        "tres-palmas-rincon-pr": "/pr/rincon/tres-palmas",
        "indicators-rincon-pr": "/pr/rincon/indicators",
        "sandy-beach-rincon-rincon-pr": "/pr/rincon/sandy-beach-rincon",
        "the-point-at-sandy-rincon-pr": "/pr/rincon/the-point-at-sandy",
      };
      const canonical = PR_RINCN_CANONICAL[segments[2]];
      if (canonical) {
        redirectUrl.pathname = canonical;
        return NextResponse.redirect(redirectUrl, { status: 301 });
      }
    }

    // Fallback: just fix the city slug (for paths not in the map)
    redirectUrl.pathname = pathname.replace("/pr/rinc-n", "/pr/rincon");
    return NextResponse.redirect(redirectUrl, { status: 301 });
  }

  /**
   * Legacy Orange County beach URL redirects
   *
   * Historical URLs used "orange-county" as the city segment, but beaches
   * are actually in specific cities. These were crawled by Google and now 404.
   * Redirect to /spots/{beach} which is the universal beach detail route.
   */
  const ocMatch = pathname.toLowerCase().match(/^\/ca\/orange-county\/([^/]+)$/);
  if (ocMatch && ocMatch[1]) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/spots/${ocMatch[1]}`;
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
   * Canonical (USA):  /{state}/{city}           (served via rewrite to /beaches/usa/{state}/{city})
   * Canonical (Intl): /{country}/{state}/{city}  (served via rewrite to /beaches/{country}/{state}/{city})
   *
   * Legacy:
   * - /beaches/{state}/{city}
   *
   * Legacy URLs redirect 301 to /beaches/usa/{state}/{city} (direct route).
   * Short URLs are served via internal rewrite for zero-redirect SEO.
   */

  // Redirect /beaches/{country}/{state}/{city} to canonical short URL
  // /beaches/usa/or/otter-rock -> /or/otter-rock (301)
  // /beaches/mexico/baja-california/rosarito -> /mexico/baja-california/rosarito (301)
  const legacyLocationMatch = pathname.match(
    /^\/beaches\/([^/]+)\/([^/]+)\/([^/]+)$/
  );
  if (legacyLocationMatch) {
    const country = legacyLocationMatch[1]?.toLowerCase() || "";
    const state = legacyLocationMatch[2]?.toLowerCase() || "";
    const city = legacyLocationMatch[3]?.toLowerCase() || "";

    // Special-case HI ambiguous city slugs to avoid redirect chains.
    if (
      (country === "usa" || country === "us") &&
      state === "hi" &&
      city === "waimea"
    ) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/hi/waimea-kauai";
      return NextResponse.redirect(redirectUrl, { status: 301 });
    }

    const redirectUrl = request.nextUrl.clone();
    if (country === "usa" || country === "us") {
      // USA: /beaches/usa/or/otter-rock -> /or/otter-rock
      redirectUrl.pathname = `/${state}/${city}`;
    } else {
      // International: /beaches/mexico/baja-california/rosarito -> /mexico/baja-california/rosarito
      redirectUrl.pathname = `/${country}/${state}/${city}`;
    }
    return NextResponse.redirect(redirectUrl, { status: 301 });
  }

  // Legacy shortcut redirect (no country segment)
  // Redirect /beaches/ca/san-diego -> /ca/san-diego
  const beachesStateCityMatch = pathname.match(/^\/beaches\/([^/]+)\/([^/]+)$/);
  if (beachesStateCityMatch) {
    const state = beachesStateCityMatch[1]?.toLowerCase() || "";
    const city = beachesStateCityMatch[2]?.toLowerCase() || "";

    if (isValidStateSlug(state)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = `/${state}/${city}`;
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

  // Rewrite short city URLs to the location page route (no visible redirect)
  // Example: /hi/haleiwa -> internally serves /beaches/usa/hi/haleiwa
  const canonicalCityMatch = pathname.match(/^\/([^/]+)\/([^/]+)$/);
  if (canonicalCityMatch) {
    const state = canonicalCityMatch[1]?.toLowerCase() || "";
    const city = canonicalCityMatch[2]?.toLowerCase() || "";

    if (isValidStateSlug(state)) {
      rewriteTarget = request.nextUrl.clone();
      rewriteTarget.pathname = `/beaches/usa/${state}/${city}`;
    }
  }

  // Rewrite short international city URLs to the location page route (no visible redirect)
  // Example: /mexico/baja-california/rosarito -> internally serves /beaches/mexico/baja-california/rosarito
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
      if (!INTERNATIONAL_RESERVED_SEGMENTS.has(country)) {
        rewriteTarget = request.nextUrl.clone();
        rewriteTarget.pathname = `/beaches/${country}/${state}/${city}`;
      }
    }
  }

  /**
   * SEO 404 Recovery
   *
   * Intercepts old beach URLs that return 404 due to:
   * - City name changes (e.g., orange-county → dana-point)
   * - URL typos (e.g., rincn → rincon)
   * - Mexico route structure changes
   *
   * Looks up beach by slug and redirects to canonical URL.
   */
  const seoResult = await handleSeoRedirect(pathname);
  if (seoResult.redirect && seoResult.url) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = seoResult.url;
    return NextResponse.redirect(redirectUrl, { status: 301 });
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

  // Create response with security headers (and optional rewrite for city URLs)
  const response = createSecureResponse(request, rewriteTarget);

  log(`[Middleware] Processing ${RouteGuard.describeRoute(routeClassification)}: ${pathname}`);

  // Always refresh the session to keep auth cookies fresh, regardless of route type.
  // This ensures users stay logged in even when browsing public pages.
  const supabaseClient = await refreshSession(request, response);

  // Public routes don't require authentication
  if (!routeClassification.requiresAuth) {
    return response;
  }

  // Protected/admin routes require authentication
  const authResult = await authenticateRequest(request, response, supabaseClient);

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
 * Create a NextResponse with security headers and attribution cookies.
 * If rewriteUrl is provided, uses NextResponse.rewrite() to serve content
 * from a different route without a visible redirect.
 */
function createSecureResponse(request: NextRequest, rewriteUrl?: URL): NextResponse {
  // Add pathname to request headers for server components to access
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  const response = rewriteUrl
    ? NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } })
    : NextResponse.next({ request: { headers: requestHeaders } });

  // Add security headers to all responses
  const isEmbedRoute = request.nextUrl.pathname.startsWith("/embed/");
  Object.entries(DEFAULT_SECURITY_HEADERS).forEach(([key, value]) => {
    // Allow embed routes to be framed by external sites
    if (isEmbedRoute && key === "X-Frame-Options") return;
    response.headers.set(key, value as string);
  });
  if (isEmbedRoute) {
    response.headers.set("Content-Security-Policy", "frame-ancestors *");
  }

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
 * Refresh the session on every request to keep auth cookies fresh.
 * Calls getSession() which will use the refresh token to obtain new
 * access/refresh tokens if the current access token is expired.
 * This does NOT make a remote auth call — it only refreshes locally.
 * Returns the Supabase client so it can be reused by authenticateRequest().
 */
async function refreshSession(
  request: NextRequest,
  response: NextResponse
): Promise<SupabaseClient | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set({ name, value, ...options })
          );
        },
      },
    });

    await supabase.auth.getSession();
    return supabase;
  } catch (error) {
    log("[Middleware] Session refresh error", error);
    return null;
  }
}

/**
 * Authenticate the request using AuthValidator
 */
async function authenticateRequest(
  request: NextRequest,
  response: NextResponse,
  existingClient?: SupabaseClient | null
) {
  const cookieCallbacks = {
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
      cookiesToSet.forEach(({ name, value }) =>
        request.cookies.set(name, value)
      );
      cookiesToSet.forEach(({ name, value, options }) =>
        response.cookies.set({ name, value, ...options })
      );
    },
  };

  const authValidator = new AuthValidator(
    request,
    cookieCallbacks,
    isVerbose,
    existingClient ?? undefined
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
     * - Vercel internal routes (/_vercel/*)
     * - Files with extensions (.svg, .png, etc.)
     * Only apply to actual page navigation
     */
    "/((?!api|_next/static|_next/image|_vercel|favicon.ico|robots.txt|sitemap).*)",
  ],
};
