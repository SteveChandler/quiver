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

import { isValidStateSlug } from "@/lib/utils/beach-url-utils";
import { COLLISION_CITY_SLUGS } from "@/lib/seo/city-collision-list";

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

/**
 * Old compound slug redirects for PR and HI beaches.
 * Migration 20260211060000 shortened these slugs, but Google still indexes the old format.
 * Maps old compound slug → canonical URL path.
 */
const OLD_COMPOUND_SLUG_REDIRECTS: Record<string, string> = {
  // Hawaii — Oahu
  "waikiki-canoes-honolulu-hi": "/hi/honolulu/waikiki-canoes",
  "waikiki-queens-honolulu-hi": "/hi/honolulu/waikiki-queens",
  "ala-moana-bowls-honolulu-hi": "/hi/honolulu/ala-moana-bowls",
  "diamond-head-cliffs-honolulu-hi": "/hi/honolulu/diamond-head-cliffs",
  "sandy-beach-honolulu-hi": "/hi/honolulu/sandy-beach",
  "sunset-beach-pupukea-hi": "/hi/pupukea/sunset-beach",
  "waimea-bay-pupukea-hi": "/hi/pupukea/waimea-bay",
  "haleiwa-haleiwa-hi": "/hi/haleiwa/haleiwa",
  "pipeline-haleiwa-hi": "/hi/haleiwa/pipeline",
  // Hawaii — Maui
  "honolua-bay-kapalua-hi": "/hi/kapalua/honolua-bay",
  "hookipa-paia-hi": "/hi/paia/hookipa",
  "lahaina-harbor-breakwall-lahaina-hi": "/hi/lahaina/lahaina-harbor-breakwall",
  // Hawaii — Kauai
  "kalapaki-beach-lihue-hi": "/hi/lihue/kalapaki-beach",
  "pakala-infinities-waimea-hi": "/hi/waimea-kauai/pakala-infinities",
  "anahola-anahola-hi": "/hi/anahola/anahola",
  // Hawaii — Big Island
  "banyans-kailua-kona-hi": "/hi/kailua-kona/banyans",
  "kahaluu-kahaluu-keauhou-hi": "/hi/kahaluu-keauhou/kahaluu",
  "pine-trees-kohanaiki-kailua-kona-hi": "/hi/kailua-kona/pine-trees-kohanaiki",
  // Puerto Rico — Rincón
  "domes-rincon-pr": "/pr/rincon/domes",
  "marias-rincon-pr": "/pr/rincon/marias",
  "tres-palmas-rincon-pr": "/pr/rincon/tres-palmas",
  "indicators-rincon-pr": "/pr/rincon/indicators",
  "sandy-beach-rincon-rincon-pr": "/pr/rincon/sandy-beach-rincon",
  "the-point-at-sandy-rincon-pr": "/pr/rincon/the-point-at-sandy",
  // Puerto Rico — Isabela
  "jobos-isabela-pr": "/pr/isabela/jobos",
  "middles-isabela-isabela-pr": "/pr/isabela/middles-isabela",
  "shacks-isabela-pr": "/pr/isabela/shacks",
  // Puerto Rico — Aguadilla
  "wilderness-aguadilla-pr": "/pr/aguadilla/wilderness",
  "crash-boat-aguadilla-pr": "/pr/aguadilla/crash-boat",
  "surfers-beach-aguadilla-pr": "/pr/aguadilla/surfers-beach",
  // Puerto Rico — Luquillo
  "la-pared-luquillo-pr": "/pr/luquillo/la-pared",
  "la-selva-luquillo-pr": "/pr/luquillo/la-selva",
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
  "guides",
  // Intent slugs (handled by /app/[intent]/ routes)
  ...INTENT_SLUGS,
]);

/**
 * URL pattern types for SEO redirect handling
 */
type UrlPatternType =
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
function handleMexicoBeachRedirect(
  _pathname: string
): SeoRedirectResult {
  // Mexico beach URLs now have a dedicated route at /mexico/[region]/[city]/[beachSlug]
  // Let the request pass through to that route instead of redirecting to /spots/
  return { redirect: false };
}

/**
 * Handle US beach URL redirects
 * Example: /hi/honolulu/waikiki-canoes-honolulu-hi → /hi/honolulu/waikiki-canoes
 *
 * Only handles static redirects from OLD_COMPOUND_SLUG_REDIRECTS (HI/PR legacy slugs).
 * The DB lookup has been removed from middleware to eliminate latency for anonymous traffic.
 * URLs with mismatched cities fall through to the page route which does its own beach lookup.
 */
function handleUsBeachRedirect(
  pathname: string
): SeoRedirectResult {
  const slug = extractBeachSlugFromPath(pathname);
  if (!slug) {
    return { redirect: false };
  }

  // Check static map of old compound slugs (pre-migration 20260211060000)
  // These are HI/PR beaches whose slugs were shortened; Google still indexes the old format.
  const canonicalFromOldSlug = OLD_COMPOUND_SLUG_REDIRECTS[slug];
  if (canonicalFromOldSlug) {
    seoLog.info("Old compound slug redirect", { from: pathname, to: canonicalFromOldSlug });
    return { redirect: true, url: canonicalFromOldSlug };
  }

  // No static redirect found. Let the request fall through to the page route,
  // which performs its own beach lookup and handles city mismatches internally.
  return { redirect: false };
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

  // Only append state suffix for collision cities (matching sitemap canonical URLs)
  const redirectUrl = COLLISION_CITY_SLUGS.has(citySlug)
    ? `/${intentSlug}/${citySlug}-${stateSlug}`
    : `/${intentSlug}/${citySlug}`;
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

  // Only append state suffix for collision cities (matching sitemap canonical URLs)
  const redirectUrl = COLLISION_CITY_SLUGS.has(citySlug)
    ? `/${intentSlug}/${citySlug}-${stateSlug}`
    : `/${intentSlug}/${citySlug}`;
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
export function handleSeoRedirect(
  pathname: string
): SeoRedirectResult {
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
