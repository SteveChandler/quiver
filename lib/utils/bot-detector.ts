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
 * Known fingerprints (append new ones here as they're identified):
 * - Pattern A: Windows + Chrome (not Edge/OPR) + 1280px viewport
 * - Pattern B: Android + Chrome (not Edge/OPR/Samsung) + 614px viewport
 *   (identified 2026-05-04 from a steady ~20s-cadence source that produced
 *   ~10,600 unflagged events on three beach pages and the map. No real
 *   Android device defaults to a 614px viewport.)
 *
 * Returns false when viewportWidth is undefined (e.g. server-side or non-browser contexts).
 */
export function isSuspiciousFingerprint(ua: string, viewportWidth?: number): boolean {
  if (!ua || viewportWidth === undefined) return false;

  const isChrome = /Chrome\//.test(ua);
  const isEdge = /Edg\//.test(ua);
  const isOpera = /OPR\//.test(ua);

  // Pattern A: Windows + Chrome + 1280px
  if (viewportWidth === 1280) {
    const isWindows = ua.includes('Windows');
    if (isWindows && isChrome && !isEdge && !isOpera) return true;
  }

  // Pattern B: Android + Chrome + 614px
  if (viewportWidth === 614) {
    const isAndroid = ua.includes('Android');
    const isSamsung = /SamsungBrowser/.test(ua);
    if (isAndroid && isChrome && !isEdge && !isOpera && !isSamsung) return true;
  }

  return false;
}
