/**
 * SEO Redirect Handler
 *
 * Handles 404 recovery for old beach URLs by looking up beaches by slug
 * and redirecting to canonical URLs.
 *
 * Use cases:
 * - City name mismatches (e.g., URLs with "orange-county" but beach is actually in "dana-point")
 * - URL typos (e.g., "rincn" instead of "rincon")
 * - Mexico route structure changes
 *
 * NOTE: Sentry and full logger removed from this file to reduce middleware bundle size.
 * Uses lightweight seoLog() helper instead.
 */

import {
  isValidStateSlug,
  stateToSlug,
  cityToSlug,
} from "@/lib/utils/beach-url-utils";

/**
 * Lightweight logger for SEO redirects (Edge-compatible, minimal bundle impact)
 * Logs are prefixed with [SEO Redirect] for easy filtering in logs
 */
const seoLog = {
  info: (message: string, data?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === "development" || process.env.LOG_SEO_REDIRECTS === "true") {
      console.log(`[SEO Redirect] ${message}`, data ?? "");
    }
  },
  warn: (message: string, data?: Record<string, unknown>) => {
    console.warn(`[SEO Redirect] ${message}`, data ?? "");
  },
};

/**
 * Puerto Rico city slug redirects for accented character normalization.
 * Maps old malformed slugs to correct ASCII slugs.
 *
 * This map can be expanded if other Puerto Rico cities with diacritics
 * have similar issues (e.g., Aguadilla, Añasco, Manatí, Mayagüez).
 * Use slugifyAscii() to determine the correct target slug.
 */
const PR_CITY_SLUG_REDIRECTS: Record<string, string> = {
  "rinc-n": "rincon",
  "rincn": "rincon",
};

// Valid intent slugs for legacy URL redirect handling
// Defined first as the single source of truth for intent paths
const INTENT_SLUGS = new Set([
  "beginner",
  "longboard",
  "tide",
  "water-temp",
  "dawn-patrol",
  "sunset",
  "least-crowded",
]);

// Reserved first-segment paths that should never be treated as state/country
const RESERVED_PATHS = new Set([
  // System routes
  "api",
  "_next",
  ".well-known",
  // App routes
  "auth",
  "admin",
  "app",
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
  "about",
  "plan-session",
  "guides",
  // Intent slugs (handled by /app/[intent]/ routes)
  ...INTENT_SLUGS,
]);

/**
 * URL pattern types for SEO redirect handling
 */
export type UrlPatternType =
  | "state-only"           // /ca, /nj, /pr
  | "us-city"              // /pr/rincon - city-level pages (for slug normalization)
  | "us-beach"             // /ca/san-diego/blacks
  | "mexico-beach"         // /mexico/baja-california/rosarito/alfonsos
  | "intent-city-legacy"   // /beginner/ca/san-diego (3-segment with state)
  | "intent-beach-legacy"  // /beginner/ca/san-diego/blacks (4-segment with beach)
  | "none";                // Not a redirect candidate

/**
 * Classify a URL pattern for redirect handling
 *
 * @param pathname - URL pathname to classify
 * @returns Pattern type for redirect handling
 */
export function classifyUrlPattern(pathname: string): UrlPatternType {
  if (!pathname || pathname === "/") {
    return "none";
  }

  const segments = pathname.split("/").filter(Boolean);
  const firstSegment = segments[0]?.toLowerCase() || "";
  const secondSegment = segments[1]?.toLowerCase() || "";

  // Skip reserved paths (except intent slugs which we handle specially)
  if (RESERVED_PATHS.has(firstSegment) && !INTENT_SLUGS.has(firstSegment)) {
    return "none";
  }

  // 3 segments: /{intent}/{state}/{city} - legacy intent URLs with state
  // These should redirect to the new 2-segment format: /{intent}/{city}
  if (
    segments.length === 3 &&
    INTENT_SLUGS.has(firstSegment) &&
    isValidStateSlug(secondSegment)
  ) {
    return "intent-city-legacy";
  }

  // 4 segments: /{intent}/{state}/{city}/{beach} - legacy intent URLs with beach
  // These should redirect to the city intent page: /{intent}/{city}
  if (
    segments.length === 4 &&
    INTENT_SLUGS.has(firstSegment) &&
    isValidStateSlug(secondSegment)
  ) {
    return "intent-beach-legacy";
  }

  // 1 segment: /{state} - state-only pages like /ca, /nj
  if (segments.length === 1 && isValidStateSlug(firstSegment)) {
    return "state-only";
  }

  // 2 segments: /{state}/{city} - US city-level pages (for slug normalization)
  // This catches malformed city slugs like /pr/rinc-n that need redirecting
  if (segments.length === 2 && isValidStateSlug(firstSegment)) {
    return "us-city";
  }

  // 3 segments: /{state}/{city}/{beach} - US beach URLs
  if (segments.length === 3 && isValidStateSlug(firstSegment)) {
    return "us-beach";
  }

  // 4 segments: /{country}/{region}/{city}/{beach} - Mexico beach URLs
  if (segments.length === 4 && firstSegment === "mexico") {
    return "mexico-beach";
  }

  return "none";
}

/**
 * Check if a pathname matches the old beach URL pattern that might 404
 * @deprecated Use classifyUrlPattern instead
 */
export function isOldBeachUrlPattern(pathname: string): boolean {
  return classifyUrlPattern(pathname) === "us-beach";
}

/**
 * Extract the beach slug from an old URL pattern
 *
 * @param pathname - URL pathname to extract slug from
 * @returns Beach slug or null if not a valid pattern
 */
export function extractBeachSlugFromPath(pathname: string): string | null {
  if (!pathname) {
    return null;
  }

  // Validate this is actually an old beach URL pattern first
  if (!isOldBeachUrlPattern(pathname)) {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 3 || segments.length === 4) {
    return segments[segments.length - 1] || null;
  }

  return null;
}

/**
 * Beach lookup result from database
 */
export interface BeachLookupResult {
  slug: string;
  state: string | null;
  city: string | null;
  name: string;
}

/**
 * City lookup result for legacy intent URL redirects
 */
export interface CityLookupResultForRedirect {
  city: string;
  state: string;
}

/**
 * Lookup city by slug using direct Supabase REST API
 *
 * Queries the beaches table to find a city and its state by slug.
 * Uses DISTINCT to deduplicate since multiple beaches may share a city.
 *
 * @param citySlug - City slug to look up (e.g., "san-diego")
 * @returns City data with state if found, null otherwise
 */
export async function lookupCityBySlugForRedirect(
  citySlug: string
): Promise<CityLookupResultForRedirect | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      seoLog.warn("Missing Supabase credentials");
      return null;
    }

    // Normalize the slug to a searchable city name pattern
    // "san-diego" -> "San Diego" (approximate - we search case-insensitively)
    const searchPattern = citySlug.replace(/-/g, " ");

    // Query beaches table for city matching the slug
    // We use ilike for case-insensitive partial match
    const url = `${supabaseUrl}/rest/v1/beaches?city=ilike.${encodeURIComponent(searchPattern)}&select=city,state&limit=1`;

    const fetchOptions: RequestInit = {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
    };

    // Add timeout signal if available (500ms to avoid blocking requests)
    if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
      fetchOptions.signal = AbortSignal.timeout(500);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      seoLog.warn("City lookup query failed", { status: response.status });
      return null;
    }

    const data = await response.json();

    if (Array.isArray(data) && data.length > 0 && data[0].city && data[0].state) {
      return {
        city: data[0].city,
        state: data[0].state,
      };
    }

    return null;
  } catch (error) {
    seoLog.warn("City lookup error", {
      citySlug,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

/**
 * Lookup beach by slug using direct Supabase REST API
 *
 * Uses fetch instead of Supabase client to avoid SSR overhead in middleware.
 * This is designed for Edge runtime where the full Supabase client may not work.
 *
 * Design principles:
 * - Fail open: If lookup fails, return null (let request pass to normal routing)
 * - Short timeout: Don't block requests waiting for slow database
 * - Minimal data: Only fetch fields needed for redirect construction
 *
 * @param slug - Beach slug to look up
 * @returns Beach data if found, null otherwise
 */
export async function lookupBeachBySlug(
  slug: string
): Promise<BeachLookupResult | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      seoLog.warn("Missing Supabase credentials");
      return null;
    }

    // Query beaches table for exact slug match
    const url = `${supabaseUrl}/rest/v1/beaches?slug=eq.${encodeURIComponent(slug)}&select=slug,state,city,name&limit=1`;

    // Create abort signal with timeout if available (Edge runtime supports this)
    // Fall back to no signal in environments that don't support AbortSignal.timeout
    const fetchOptions: RequestInit = {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
    };

    // Add timeout signal if available (500ms to avoid blocking requests)
    if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
      fetchOptions.signal = AbortSignal.timeout(500);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      seoLog.warn("Supabase query failed", { status: response.status });
      return null;
    }

    const data = await response.json();

    if (Array.isArray(data) && data.length > 0) {
      return data[0] as BeachLookupResult;
    }

    return null;
  } catch (error) {
    seoLog.warn("Beach lookup error", {
      slug,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

/**
 * Build canonical URL for a beach
 *
 * For US beaches with valid state and city, builds: /{state}/{city}/{slug}
 * For international or incomplete data, falls back to: /spots/{slug}
 *
 * @param beach - Beach data from database lookup
 * @returns Canonical URL path or null if slug is missing
 */
export function buildCanonicalBeachUrl(
  beach: BeachLookupResult
): string | null {
  if (!beach.slug) {
    return null;
  }

  const stateSlug = stateToSlug(beach.state);
  const citySlug = cityToSlug(beach.city);

  // For US states with valid state and city, build hierarchical URL
  if (stateSlug && isValidStateSlug(stateSlug) && citySlug) {
    return `/${stateSlug}/${citySlug}/${beach.slug}`;
  }

  // For international beaches or missing data, fall back to /spots/ route
  return `/spots/${beach.slug}`;
}

/**
 * Result of SEO redirect check
 */
export interface SeoRedirectResult {
  redirect: boolean;
  url?: string;
}

/**
 * Handle state-only URL redirects
 * Example: /ca → /beaches/usa/ca
 */
function handleStateOnlyRedirect(pathname: string): SeoRedirectResult {
  const segments = pathname.split("/").filter(Boolean);
  const stateSlug = segments[0]?.toLowerCase();

  if (!stateSlug || !isValidStateSlug(stateSlug)) {
    return { redirect: false };
  }

  const redirectUrl = `/beaches/usa/${stateSlug}`;
  seoLog.info("State-only redirect", { from: pathname, to: redirectUrl });
  return { redirect: true, url: redirectUrl };
}

/**
 * Handle US city URL redirects for malformed slugs
 * Example: /pr/rinc-n → /pr/rincon (fixes accented character slug issues)
 *
 * This primarily handles Puerto Rico cities with accented characters
 * that were incorrectly slugified (e.g., "Rincón" → "rinc-n" instead of "rincon")
 */
function handleUsCityRedirect(pathname: string): SeoRedirectResult {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length !== 2) {
    return { redirect: false };
  }

  const stateSlug = segments[0]?.toLowerCase() || "";
  const citySlug = segments[1]?.toLowerCase() || "";

  if (!stateSlug || !citySlug) {
    return { redirect: false };
  }

  // Check if this city slug needs redirecting (e.g., PR accented city fixes)
  const correctedCitySlug = PR_CITY_SLUG_REDIRECTS[citySlug];
  if (correctedCitySlug && correctedCitySlug !== citySlug) {
    const redirectUrl = `/${stateSlug}/${correctedCitySlug}`;
    seoLog.info("PR city slug fix", { from: pathname, to: redirectUrl });
    return { redirect: true, url: redirectUrl };
  }

  return { redirect: false };
}

/**
 * Handle Mexico beach URL redirects
 * Mexico beach URLs now have a dedicated route at /mexico/[region]/[city]/[beachSlug]
 * Let requests pass through to that route instead of redirecting to /spots/
 */
async function handleMexicoBeachRedirect(
  _pathname: string
): Promise<SeoRedirectResult> {
  // Mexico beach URLs now have a dedicated route at /mexico/[region]/[city]/[beachSlug]
  // Let the request pass through to that route instead of redirecting to /spots/
  return { redirect: false };
}

/**
 * Handle US beach URL redirects
 * Example: /ca/orange-county/doheny-state-beach → /ca/dana-point/doheny-state-beach
 */
async function handleUsBeachRedirect(
  pathname: string
): Promise<SeoRedirectResult> {
  const slug = extractBeachSlugFromPath(pathname);
  if (!slug) {
    return { redirect: false };
  }

  // Lookup beach in database
  const beach = await lookupBeachBySlug(slug);
  if (!beach) {
    return { redirect: false };
  }

  // Build canonical URL
  const canonicalUrl = buildCanonicalBeachUrl(beach);
  if (!canonicalUrl) {
    return { redirect: false };
  }

  // Check if current URL matches canonical (case-insensitive)
  if (pathname.toLowerCase() === canonicalUrl.toLowerCase()) {
    return { redirect: false };
  }

  seoLog.info("Beach URL redirect", { from: pathname, to: canonicalUrl });
  return { redirect: true, url: canonicalUrl };
}

/**
 * Handle 3-segment intent URL redirects (intent + state + city)
 * Example: /sunset/ca/san-diego → /sunset/san-diego
 *
 * These are legacy URLs that included the state segment.
 * The new format uses only 2 segments: /{intent}/{city}
 */
function handleIntentCityLegacyRedirect(pathname: string): SeoRedirectResult {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length !== 3) {
    return { redirect: false };
  }

  const intentSlug = segments[0]?.toLowerCase() || "";
  const stateSlug = segments[1]?.toLowerCase() || "";
  const citySlug = segments[2]?.toLowerCase() || "";

  if (!INTENT_SLUGS.has(intentSlug) || !citySlug || !stateSlug) {
    return { redirect: false };
  }

  // Redirect to 2-segment format with state suffix: /{intent}/{city}-{state}
  // This avoids double redirect chains (e.g., /tide/or/seaside → /tide/seaside-or)
  const redirectUrl = `/${intentSlug}/${citySlug}-${stateSlug}`;
  seoLog.info("Intent city legacy redirect", { from: pathname, to: redirectUrl });
  return { redirect: true, url: redirectUrl };
}

/**
 * Handle 4-segment intent URL redirects (intent + state + city + beach)
 * Example: /sunset/ca/san-diego/blacks → /sunset/san-diego
 *
 * These are legacy URLs that included both state and beach segments.
 * We redirect to the city intent page since that's the best match for the user's intent.
 */
function handleIntentBeachLegacyRedirect(pathname: string): SeoRedirectResult {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length !== 4) {
    return { redirect: false };
  }

  const intentSlug = segments[0]?.toLowerCase() || "";
  const stateSlug = segments[1]?.toLowerCase() || "";
  const citySlug = segments[2]?.toLowerCase() || "";
  // segments[3] is the beach slug - we skip it (redirect to city intent page)

  if (!INTENT_SLUGS.has(intentSlug) || !citySlug || !stateSlug) {
    return { redirect: false };
  }

  // Redirect to 2-segment format with state suffix: /{intent}/{city}-{state}
  // This avoids double redirect chains (e.g., /tide/or/seaside/beach → /tide/seaside-or)
  const redirectUrl = `/${intentSlug}/${citySlug}-${stateSlug}`;
  seoLog.info("Intent beach legacy redirect", { from: pathname, to: redirectUrl });
  return { redirect: true, url: redirectUrl };
}

/**
 * Main handler for SEO redirects
 *
 * Handles multiple URL pattern types:
 * - State-only: /ca → /beaches/usa/ca
 * - US city: /pr/rinc-n → /pr/rincon (fixes accented character slug issues)
 * - US beach: /ca/orange-county/doheny → /ca/dana-point/doheny
 * - Mexico beach: /mexico/baja-california/rosarito/alfonsos → /spots/alfonsos
 * - Intent city legacy: /sunset/ca/san-diego → /sunset/san-diego
 * - Intent beach legacy: /sunset/ca/san-diego/blacks → /sunset/san-diego
 *
 * Design principles:
 * - Fail open: If anything goes wrong, return no redirect (let request pass)
 * - Only redirect when needed: Skip DB lookup for non-matching URLs
 * - Preserve SEO: Use 301 redirects for permanent moves
 *
 * @param pathname - URL pathname to check
 * @returns Redirect info if URL should redirect, otherwise { redirect: false }
 */
export async function handleSeoRedirect(
  pathname: string
): Promise<SeoRedirectResult> {
  try {
    const patternType = classifyUrlPattern(pathname);

    switch (patternType) {
      case "state-only":
        return handleStateOnlyRedirect(pathname);

      case "us-city":
        return handleUsCityRedirect(pathname);

      case "us-beach":
        return handleUsBeachRedirect(pathname);

      case "mexico-beach":
        return handleMexicoBeachRedirect(pathname);

      case "intent-city-legacy":
        return handleIntentCityLegacyRedirect(pathname);

      case "intent-beach-legacy":
        return handleIntentBeachLegacyRedirect(pathname);

      case "none":
      default:
        return { redirect: false };
    }
  } catch (error) {
    seoLog.warn("Handler error", {
      pathname,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return { redirect: false };
  }
}
