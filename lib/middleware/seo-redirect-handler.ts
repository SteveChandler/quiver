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
 */

import * as Sentry from "@sentry/nextjs";
import {
  isValidStateSlug,
  stateToSlug,
  cityToSlug,
} from "@/lib/utils/beach-url-utils";

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
  "beginner",
  "longboard",
  "tide",
  "water-temp",
  "dawn-patrol",
  "sunset",
  "least-crowded",
]);

// Valid intent slugs for legacy URL redirect handling
const INTENT_SLUGS = new Set([
  "beginner",
  "longboard",
  "tide",
  "water-temp",
  "dawn-patrol",
  "sunset",
  "least-crowded",
]);

/**
 * URL pattern types for SEO redirect handling
 */
export type UrlPatternType =
  | "state-only"      // /ca, /nj, /pr
  | "us-beach"        // /ca/san-diego/blacks
  | "mexico-beach"    // /mexico/baja-california/rosarito/alfonsos
  | "legacy-intent"   // /beginner/san-diego (old format without state)
  | "none";           // Not a redirect candidate

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

  // 2 segments: /{intent}/{city} - legacy intent URLs without state
  // Must match: first segment is intent, second is NOT a state slug
  // (If second segment IS a state slug, let it pass to [intent]/[state] route)
  if (
    segments.length === 2 &&
    INTENT_SLUGS.has(firstSegment) &&
    !isValidStateSlug(secondSegment)
  ) {
    return "legacy-intent";
  }

  // 1 segment: /{state} - state-only pages like /ca, /nj
  if (segments.length === 1 && isValidStateSlug(firstSegment)) {
    return "state-only";
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
      console.warn("[SEO Redirect] Missing Supabase credentials");
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
      console.warn("[SEO Redirect] City lookup query failed:", response.status);
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
    Sentry.withScope((scope) => {
      scope.setTag('seo_redirect_type', 'city_lookup');
      scope.setContext('redirect_context', { citySlug });
      Sentry.captureException(error);
    });
    console.warn("[SEO Redirect] City lookup error:", error instanceof Error ? error.message : "Unknown error");
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
      console.warn("[SEO Redirect] Missing Supabase credentials");
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
      console.warn("[SEO Redirect] Supabase query failed:", response.status);
      return null;
    }

    const data = await response.json();

    if (Array.isArray(data) && data.length > 0) {
      return data[0] as BeachLookupResult;
    }

    return null;
  } catch (error) {
    Sentry.withScope((scope) => {
      scope.setTag('seo_redirect_type', 'beach_lookup');
      scope.setContext('redirect_context', { slug });
      Sentry.captureException(error);
    });
    console.warn("[SEO Redirect] Lookup error:", error instanceof Error ? error.message : "Unknown error");
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
  console.log(`[SEO Redirect] ${pathname} → ${redirectUrl}`);
  return { redirect: true, url: redirectUrl };
}

/**
 * Handle Mexico beach URL redirects
 * Example: /mexico/baja-california/rosarito/alfonsos → /spots/alfonsos
 */
async function handleMexicoBeachRedirect(
  pathname: string
): Promise<SeoRedirectResult> {
  const segments = pathname.split("/").filter(Boolean);

  // Extract beach slug (last segment)
  const beachSlug = segments[segments.length - 1];
  if (!beachSlug) {
    return { redirect: false };
  }

  // Verify the beach exists before redirecting
  const beach = await lookupBeachBySlug(beachSlug);
  if (!beach) {
    return { redirect: false };
  }

  // Redirect to /spots/{slug}
  const redirectUrl = `/spots/${beach.slug}`;
  console.log(`[SEO Redirect] ${pathname} → ${redirectUrl}`);
  return { redirect: true, url: redirectUrl };
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

  console.log(`[SEO Redirect] ${pathname} → ${canonicalUrl}`);
  return { redirect: true, url: canonicalUrl };
}

/**
 * Handle legacy intent URL redirects
 * Example: /beginner/san-diego → /beginner/ca/san-diego
 *
 * These are old URLs from before we added the state segment.
 * We look up the city to find its state and redirect to the new format.
 */
async function handleLegacyIntentRedirect(
  pathname: string
): Promise<SeoRedirectResult> {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length !== 2) {
    return { redirect: false };
  }

  const intentSlug = segments[0]?.toLowerCase() || "";
  const citySlug = segments[1]?.toLowerCase() || "";

  if (!INTENT_SLUGS.has(intentSlug) || !citySlug) {
    return { redirect: false };
  }

  // Lookup city to find its state
  const cityData = await lookupCityBySlugForRedirect(citySlug);

  if (!cityData) {
    // City not found - let request pass through to 404
    return { redirect: false };
  }

  // Convert state to slug (e.g., "California" -> "ca")
  const stateSlug = stateToSlug(cityData.state);
  if (!stateSlug) {
    return { redirect: false };
  }

  // Build new URL: /{intent}/{state}/{city}
  const redirectUrl = `/${intentSlug}/${stateSlug}/${citySlug}`;
  console.log(`[SEO Redirect] Legacy intent ${pathname} → ${redirectUrl}`);
  return { redirect: true, url: redirectUrl };
}

/**
 * Main handler for SEO redirects
 *
 * Handles multiple URL pattern types:
 * - State-only: /ca → /beaches/usa/ca
 * - US beach: /ca/orange-county/doheny → /ca/dana-point/doheny
 * - Mexico beach: /mexico/baja-california/rosarito/alfonsos → /spots/alfonsos
 * - Legacy intent: /beginner/san-diego → /beginner/ca/san-diego
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

      case "us-beach":
        return handleUsBeachRedirect(pathname);

      case "mexico-beach":
        return handleMexicoBeachRedirect(pathname);

      case "legacy-intent":
        return handleLegacyIntentRedirect(pathname);

      case "none":
      default:
        return { redirect: false };
    }
  } catch (error) {
    Sentry.withScope((scope) => {
      scope.setTag('seo_redirect_type', 'handler_error');
      scope.setContext('redirect_context', { pathname });
      Sentry.captureException(error);
    });
    return { redirect: false };
  }
}
