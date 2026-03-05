const BOT_PATTERNS =
  /Googlebot|Bingbot|baiduspider|YandexBot|DuckDuckBot|Slurp|facebookexternalhit|Twitterbot|LinkedInBot|bot|crawler|spider|headless|phantomjs|puppeteer|playwright|Applebot|AhrefsBot|SemrushBot|MJ12bot/i;

/** Check if a User-Agent string belongs to a known bot/crawler */
export function isBot(ua: string): boolean {
  if (!ua) return false;
  return BOT_PATTERNS.test(ua);
}
