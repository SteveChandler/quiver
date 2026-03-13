const BOT_PATTERNS =
  /Googlebot|Bingbot|baiduspider|YandexBot|DuckDuckBot|Slurp|facebookexternalhit|Twitterbot|LinkedInBot|bot|crawler|spider|headless|phantomjs|puppeteer|playwright|Applebot|AhrefsBot|SemrushBot|MJ12bot/i;

/**
 * Check if a User-Agent string belongs to a known bot/crawler or is suspiciously absent.
 *
 * Empty/missing user-agents are treated as bots because real browsers always
 * send a user-agent. ~53% of /api/events traffic was identified as bot-origin;
 * missing UA accounts for a significant portion of that.
 */
export function isBot(ua: string): boolean {
  if (!ua) return true; // No user-agent → treat as bot
  return BOT_PATTERNS.test(ua);
}

/**
 * Check if a request matches a known bot fingerprint pattern based on viewport + UA.
 *
 * The primary pattern targeted: Windows + Chrome (not Edge/OPR) + exactly 1280px viewport.
 * This combination was identified in analytics as a high-volume bot that uses a real
 * Chrome UA string but fires events with a consistent 1280px viewport width.
 *
 * Returns false when viewportWidth is undefined (e.g. server-side or non-browser contexts).
 */
export function isSuspiciousFingerprint(ua: string, viewportWidth?: number): boolean {
  if (!ua || viewportWidth === undefined) return false;
  if (viewportWidth !== 1280) return false;

  const isWindows = ua.includes('Windows');
  const isChrome = /Chrome\//.test(ua);
  const isEdge = /Edg\//.test(ua);
  const isOpera = /OPR\//.test(ua);

  return isWindows && isChrome && !isEdge && !isOpera;
}
