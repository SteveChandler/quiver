import { remoteImageUrlOrUndefined } from "@/lib/share/remote-image-url";

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
function buildWaveShareUrl(params: WaveShareParams): string {
  const baseUrl = getBaseUrl();
  const searchParams = new URLSearchParams();

  searchParams.set('size', params.size);
  searchParams.set('desc', params.desc);

  return `${baseUrl}/api/og/wave?${searchParams.toString()}`;
}

/**
 * Parameters for surf call share card
 */
export interface SurfCallShareParams {
  /** Beach name */
  beach: string;
  /** Verdict (YES, MAYBE, NO) */
  verdict: string;
  /** Window time range (e.g., "6:30-10:15 AM") */
  window: string;
  /** Wave height (e.g., "3-5ft") */
  waveHeight: string;
  /** Wind description (e.g., "Light offshore") */
  wind: string;
  /** Comma-separated trend tags */
  tags?: string;
  /** Score as integer (0-100), e.g., 81 for 8.1/10 */
  score?: number;
  /** Headline text (e.g., "Tomorrow at Big Jetty") */
  headline?: string;
  /** Condition label (e.g., "Great Conditions", "Good Conditions") */
  conditionLabel?: string;
  /** Tide badge (e.g., "Falling Tide", "Rising Tide") */
  tideBadge?: string;
  /** Natural language message about conditions */
  message?: string;
  /** Time context (e.g., "Tomorrow Morning", "This Afternoon") */
  timeContext?: string;
}

/**
 * Build a fully qualified URL for surf call share OG image
 *
 * @example
 * buildSurfCallShareUrl({
 *   beach: "Malibu",
 *   verdict: "YES",
 *   window: "6:30-10:15 AM",
 *   waveHeight: "3-5ft",
 *   wind: "Light offshore",
 *   tags: "Clean Swell,Winds Dropping"
 * })
 * // => "https://quiversurf.app/api/og/surf-call?beach=Malibu&verdict=YES&..."
 */
export function buildSurfCallShareUrl(params: SurfCallShareParams): string {
  const baseUrl = getBaseUrl();
  const searchParams = new URLSearchParams();

  searchParams.set('beach', params.beach);
  searchParams.set('verdict', params.verdict);
  searchParams.set('window', params.window);
  searchParams.set('waveHeight', params.waveHeight);
  searchParams.set('wind', params.wind);

  if (params.tags) {
    searchParams.set('tags', params.tags);
  }

  if (params.score !== undefined) {
    searchParams.set('score', params.score.toString());
  }

  if (params.headline) {
    searchParams.set('headline', params.headline);
  }

  if (params.conditionLabel) {
    searchParams.set('conditionLabel', params.conditionLabel);
  }

  if (params.tideBadge) {
    searchParams.set('tideBadge', params.tideBadge);
  }

  if (params.message) {
    searchParams.set('message', params.message);
  }

  if (params.timeContext) {
    searchParams.set('timeContext', params.timeContext);
  }

  return `${baseUrl}/api/og/surf-call?${searchParams.toString()}`;
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
  const bg = remoteImageUrlOrUndefined(params.bg);
  if (bg) {
    searchParams.set('bg', bg);
  }

  return `${baseUrl}/api/og/session?${searchParams.toString()}`;
}

/**
 * Parameters for monthly progression recap share card
 */
export interface ProgressionShareParams {
  /** Total sessions in the period */
  sessions: number;
  /** Total hours surfed */
  hours: number;
  /** Average session rating (1-5) */
  avgRating: number;
  /** Top skill name (e.g., "Pop-ups") */
  topSkill?: string;
  /** Top skill rating (1-5) */
  topSkillRating?: number;
  /** Longest streak in days */
  streak?: number;
  /** Month label (e.g., "March 2026") */
  month: string;
  /** Forecast impact string (e.g., "+8% at Blacks") */
  forecastImpact?: string;
}

/**
 * Parameters for streak milestone share card
 */
export interface StreakShareParams {
  /** Number of consecutive days */
  streak: number;
  /** User's display name */
  userName?: string;
}

/**
 * Build a fully qualified URL for progression recap OG image
 *
 * @example
 * buildProgressionShareUrl({ sessions: 12, hours: 18.5, avgRating: 4.2, month: "March 2026" })
 * // => "https://quiversurf.app/api/og/progression?sessions=12&hours=18.5&avgRating=4.2&month=March+2026"
 */
export function buildProgressionShareUrl(params: ProgressionShareParams): string {
  const baseUrl = getBaseUrl();
  const searchParams = new URLSearchParams();

  searchParams.set('sessions', params.sessions.toString());
  searchParams.set('hours', params.hours.toString());
  searchParams.set('avgRating', params.avgRating.toString());
  searchParams.set('month', params.month);

  if (params.topSkill) {
    searchParams.set('topSkill', params.topSkill);
  }
  if (params.topSkillRating !== undefined) {
    searchParams.set('topSkillRating', params.topSkillRating.toString());
  }
  if (params.streak !== undefined) {
    searchParams.set('streak', params.streak.toString());
  }
  if (params.forecastImpact) {
    searchParams.set('forecastImpact', params.forecastImpact);
  }

  return `${baseUrl}/api/og/progression?${searchParams.toString()}`;
}

/**
 * Build a fully qualified URL for streak milestone OG image
 *
 * @example
 * buildStreakShareUrl({ streak: 7, userName: "Steven" })
 * // => "https://quiversurf.app/api/og/streak?streak=7&userName=Steven"
 */
export function buildStreakShareUrl(params: StreakShareParams): string {
  const baseUrl = getBaseUrl();
  const searchParams = new URLSearchParams();

  searchParams.set('streak', params.streak.toString());

  if (params.userName) {
    searchParams.set('userName', params.userName);
  }

  return `${baseUrl}/api/og/streak?${searchParams.toString()}`;
}
