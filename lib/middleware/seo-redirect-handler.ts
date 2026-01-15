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

import { isValidStateSlug } from "@/lib/utils/beach-url-utils";

// Reserved first-segment paths that should never be treated as state/country
const RESERVED_PATHS = new Set([
  "api",
  "_next",
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
  ".well-known",
  "about",
  "plan-session",
]);

/**
 * Check if a pathname matches the old beach URL pattern that might 404
 *
 * Valid patterns:
 * - 3 segments: /{state}/{city}/{beach} where state is a valid US state slug
 * - 4 segments: /{country}/{region}/{city}/{beach} where country is "mexico"
 *
 * @param pathname - URL pathname to check
 * @returns true if pathname matches an old beach URL pattern
 */
export function isOldBeachUrlPattern(pathname: string): boolean {
  // Handle empty or minimal paths
  if (!pathname || pathname === "/") {
    return false;
  }

  const segments = pathname.split("/").filter(Boolean);

  // Must have 3 or 4 segments
  if (segments.length < 3 || segments.length > 4) {
    return false;
  }

  const firstSegment = segments[0]?.toLowerCase() || "";

  // Skip reserved paths
  if (RESERVED_PATHS.has(firstSegment)) {
    return false;
  }

  // 3 segments: /{state}/{city}/{beach} - state must be valid 2-letter code
  if (segments.length === 3) {
    return isValidStateSlug(firstSegment);
  }

  // 4 segments: /{country}/{region}/{city}/{beach} - for mexico URLs
  if (segments.length === 4) {
    return firstSegment === "mexico";
  }

  return false;
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
    // Fail open - don't block requests on lookup errors
    console.warn(
      "[SEO Redirect] Lookup error:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return null;
  }
}
