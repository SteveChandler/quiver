/**
 * Share Card URL Builders
 *
 * Simple helper functions to build OG image URLs for sharing.
 * Keeps UI components dumb - they just call these and get valid URLs.
 */

/**
 * Get the base URL for constructing absolute URLs
 */
function getBaseUrl(): string {
  // Server-side: use NEXT_PUBLIC_APP_URL or default
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_APP_URL || 'https://quiversurf.app';
  }
  // Client-side: use window.location.origin
  // eslint-disable-next-line no-restricted-properties -- Need origin for URL building, not navigation
  return window.location.origin;
}

/**
 * Parameters for wave share card
 */
export interface WaveShareParams {
  /** Wave size (e.g., "3-5ft") */
  size: string;
  /** Wave description (e.g., "Clean and glassy") */
  desc: string;
}

/**
 * Parameters for session share card
 */
export interface SessionShareParams {
  /** Beach name */
  beach: string;
  /** Session rating (e.g., "Epic", "Good", "Fair") */
  rating: string;
  /** Star rating (1-5) */
  stars: number;
  /** Wave size (e.g., "3-5ft") */
  size: string;
  /** Board used (e.g., "6'2\" Shortboard") */
  board: string;
  /** Date string for the session (e.g., "December 23, 2025") */
  date?: string;
  /** Wind label (e.g., "Light Offshore") */
  windLabel?: string;
  /** Wind speed (e.g., "7 mph") */
  windSpeed?: string;
  /** Tagline/summary line (e.g., "Solid Snake: Smooth walls, long rights…") */
  tagline?: string;
  /** Footer line (e.g., "Similar to your best Ocean Beach sessions") */
  footer?: string;
  /** Background image URL (optional) */
  bg?: string;
}

/**
 * Build a fully qualified URL for wave share OG image
 *
 * @example
 * buildWaveShareUrl({ size: "3-5ft", desc: "Clean and glassy" })
 * // => "https://quiversurf.app/api/og/wave?size=3-5ft&desc=Clean%20and%20glassy"
 */
export function buildWaveShareUrl(params: WaveShareParams): string {
  const baseUrl = getBaseUrl();
  const searchParams = new URLSearchParams();

  searchParams.set('size', params.size);
  searchParams.set('desc', params.desc);

  return `${baseUrl}/api/og/wave?${searchParams.toString()}`;
}

/**
 * Build a fully qualified URL for session share OG image
 *
 * @example
 * buildSessionShareUrl({
 *   beach: "Pipeline",
 *   rating: "Epic",
 *   stars: 5,
 *   size: "6-8ft",
 *   board: "6'2\" Shortboard",
 *   bg: "https://example.com/bg.jpg"
 * })
 * // => "https://quiversurf.app/api/og/session?beach=Pipeline&rating=Epic&stars=5&size=6-8ft&board=6%272%22%20Shortboard&bg=https%3A%2F%2Fexample.com%2Fbg.jpg"
 */
export function buildSessionShareUrl(params: SessionShareParams): string {
  const baseUrl = getBaseUrl();
  const searchParams = new URLSearchParams();

  searchParams.set('beach', params.beach);
  searchParams.set('rating', params.rating);
  searchParams.set('stars', params.stars.toString());
  searchParams.set('size', params.size);
  searchParams.set('board', params.board);

  if (params.date) {
    searchParams.set('date', params.date);
  }
  if (params.windLabel) {
    searchParams.set('windLabel', params.windLabel);
  }
  if (params.windSpeed) {
    searchParams.set('windSpeed', params.windSpeed);
  }
  if (params.tagline) {
    searchParams.set('tagline', params.tagline);
  }
  if (params.footer) {
    searchParams.set('footer', params.footer);
  }
  if (params.bg) {
    searchParams.set('bg', params.bg);
  }

  return `${baseUrl}/api/og/session?${searchParams.toString()}`;
}
