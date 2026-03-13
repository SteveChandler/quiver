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
