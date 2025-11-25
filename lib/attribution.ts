/**
 * Attribution Capture & Persistence
 *
 * Captures UTM parameters and referrer data for analytics attribution.
 * Implements first-touch and last-touch attribution models.
 *
 * Cookie Structure:
 * - qvr_utm_source: Traffic source (e.g., instagram, google)
 * - qvr_utm_medium: Marketing medium (e.g., social, cpc, email)
 * - qvr_utm_campaign: Campaign name
 * - qvr_utm_content: Ad content identifier
 * - qvr_utm_term: Search keywords
 * - qvr_referrer: Original referrer URL
 * - qvr_first_touch_ts: Timestamp of first visit
 * - qvr_landing_page: Original landing page URL
 */

// Cookie configuration
const COOKIE_PREFIX = "qvr_";
const COOKIE_EXPIRY_DAYS = 90;
const COOKIE_OPTIONS = "path=/; SameSite=Lax; Secure";

// UTM parameter names
export const UTM_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export type UTMParam = (typeof UTM_PARAMS)[number];

export interface AttributionData {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
  first_touch_ts: string | null;
  landing_page: string | null;
}

/**
 * Parse UTM parameters from a URL or search string
 */
export function parseUTMParams(
  urlOrSearch: string | URL | URLSearchParams
): Partial<AttributionData> {
  let searchParams: URLSearchParams;

  if (typeof urlOrSearch === "string") {
    try {
      // Try parsing as full URL first
      const url = new URL(urlOrSearch, "http://localhost");
      searchParams = url.searchParams;
    } catch {
      // Fall back to treating as search string
      searchParams = new URLSearchParams(urlOrSearch);
    }
  } else if (urlOrSearch instanceof URL) {
    searchParams = urlOrSearch.searchParams;
  } else {
    searchParams = urlOrSearch;
  }

  const result: Partial<AttributionData> = {};

  for (const param of UTM_PARAMS) {
    const value = searchParams.get(param);
    if (value) {
      result[param] = value;
    }
  }

  return result;
}

/**
 * Check if URL contains any UTM parameters
 */
export function hasUTMParams(urlOrSearch: string | URL | URLSearchParams): boolean {
  const parsed = parseUTMParams(urlOrSearch);
  return Object.values(parsed).some((v) => v != null);
}

/**
 * Get cookie value by name (client-side)
 */
export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const cookieName = name.startsWith(COOKIE_PREFIX) ? name : `${COOKIE_PREFIX}${name}`;
  const cookies = document.cookie.split(";");

  for (const cookie of cookies) {
    const [key, value] = cookie.trim().split("=");
    if (key === cookieName) {
      return decodeURIComponent(value);
    }
  }

  return null;
}

/**
 * Set cookie with expiry (client-side)
 */
export function setCookie(name: string, value: string, days: number = COOKIE_EXPIRY_DAYS): void {
  if (typeof document === "undefined") return;

  const cookieName = name.startsWith(COOKIE_PREFIX) ? name : `${COOKIE_PREFIX}${name}`;
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);

  document.cookie = `${cookieName}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; ${COOKIE_OPTIONS}`;
}

/**
 * Get all attribution data from cookies (client-side)
 */
export function getAttributionFromCookies(): AttributionData {
  return {
    utm_source: getCookie("utm_source"),
    utm_medium: getCookie("utm_medium"),
    utm_campaign: getCookie("utm_campaign"),
    utm_content: getCookie("utm_content"),
    utm_term: getCookie("utm_term"),
    referrer: getCookie("referrer"),
    first_touch_ts: getCookie("first_touch_ts"),
    landing_page: getCookie("landing_page"),
  };
}

/**
 * Save attribution data to cookies (client-side)
 * Uses first-touch model - only saves if not already set
 */
export function saveAttributionToCookies(
  data: Partial<AttributionData>,
  options: { overwrite?: boolean; days?: number } = {}
): void {
  const { overwrite = false, days = COOKIE_EXPIRY_DAYS } = options;

  for (const [key, value] of Object.entries(data)) {
    if (value != null && value !== "") {
      const existing = getCookie(key);
      // First-touch: only set if not already present (unless overwrite is true)
      if (overwrite || !existing) {
        setCookie(key, value, days);
      }
    }
  }
}

/**
 * Get attribution data formatted for analytics events
 * Filters out null values and adds prefix if needed
 */
export function getAttributionForAnalytics(
  options: { prefix?: string; includeTimestamp?: boolean } = {}
): Record<string, string> {
  const { prefix = "", includeTimestamp = false } = options;
  const attribution = getAttributionFromCookies();
  const result: Record<string, string> = {};

  // Add UTM params
  for (const param of UTM_PARAMS) {
    const value = attribution[param];
    if (value) {
      result[prefix + param] = value;
    }
  }

  // Add referrer
  if (attribution.referrer) {
    result[prefix + "referrer"] = attribution.referrer;
  }

  // Optionally add timestamp
  if (includeTimestamp && attribution.first_touch_ts) {
    result[prefix + "first_touch_ts"] = attribution.first_touch_ts;
  }

  return result;
}

/**
 * Parse attribution from request cookies (server-side, for middleware)
 */
export function parseAttributionFromRequestCookies(
  cookieHeader: string | null
): AttributionData {
  const result: AttributionData = {
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    referrer: null,
    first_touch_ts: null,
    landing_page: null,
  };

  if (!cookieHeader) return result;

  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [key, value] = cookie.trim().split("=");
    const cleanKey = key.replace(COOKIE_PREFIX, "");

    if (cleanKey in result) {
      (result as any)[cleanKey] = decodeURIComponent(value);
    }
  }

  return result;
}

/**
 * Generate Set-Cookie headers for attribution (server-side, for middleware)
 */
export function generateAttributionCookieHeaders(
  data: Partial<AttributionData>,
  existingAttribution: AttributionData
): string[] {
  const headers: string[] = [];
  const expires = new Date();
  expires.setTime(expires.getTime() + COOKIE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const expiresStr = expires.toUTCString();

  for (const [key, value] of Object.entries(data)) {
    if (value != null && value !== "") {
      // First-touch model: only set if not already present
      const existingValue = (existingAttribution as any)[key];
      if (!existingValue) {
        headers.push(
          `${COOKIE_PREFIX}${key}=${encodeURIComponent(value)}; Expires=${expiresStr}; Path=/; SameSite=Lax; Secure`
        );
      }
    }
  }

  return headers;
}

