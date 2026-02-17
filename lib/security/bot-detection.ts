/**
 * Bot Detection Utility
 *
 * Detects bot traffic based on multiple signals:
 * - User-Agent patterns (known bots)
 * - Missing Accept-Language header (suspicious)
 * - Empty/missing user agent
 *
 * Used to filter bot traffic from:
 * - GA4 analytics pollution
 * - API endpoint hammering
 */

import { NextRequest } from "next/server";

/**
 * Bot User-Agent patterns to BLOCK
 * These bots hammer APIs and pollute analytics
 */
const BOT_USER_AGENTS = [
  // SEO/Crawler bots (blocking API access, not page access)
  "ahrefsbot",
  "semrushbot",
  "mj12bot",
  "dotbot",
  "blexbot",
  "crunchbot",
  "dataforseobot",
  "petalbot",
  "bytespider",
  "serpstatbot",
  "megaindex",
  "rogerbot",
  "screaming frog",
  "sistrix",
  "zoominfobot",
  "majestic",
  "spbot",
  "linkdexbot",

  // Generic crawlers
  "scrapy",
  "curl/",
  "wget/",
  "python-requests",
  "python-urllib",
  "httpx/",
  "go-http-client",
  "java/",
  "libwww",
  "axios/",
  "node-fetch",
  "got/",
  "undici",

  // Automation tools
  "headlesschrome",
  "phantomjs",
  "selenium",
  "puppeteer",
  "playwright",
  "webdriver",
  "chrome-lighthouse",
] as const;

/**
 * Good bots to ALLOW (search engines for SEO)
 * These should pass through to help with indexing
 */
const ALLOWED_BOTS = [
  "googlebot",
  "bingbot",
  "duckduckbot",
  "applebot",
  "yandex",
  "facebookexternalhit", // For OG tags on page requests
  "twitterbot",
  "linkedinbot",
  "whatsapp",
  "slackbot",
  "telegrambot",
  "discordbot",
  "pinterest",
] as const;

export interface BotDetectionResult {
  isBot: boolean;
  reason: string | null;
  botName: string | null;
  shouldBlock: boolean;
}

/**
 * Detect if request is from a bot
 *
 * @param request - NextRequest object
 * @returns BotDetectionResult with detection details
 */
export function detectBot(request: NextRequest): BotDetectionResult {
  const userAgent = (request.headers.get("user-agent") || "").toLowerCase();
  const acceptLanguage = request.headers.get("accept-language");

  // 1. Check for allowed bots first (good crawlers should pass)
  for (const goodBot of ALLOWED_BOTS) {
    if (userAgent.includes(goodBot)) {
      return {
        isBot: true,
        reason: "allowed-bot",
        botName: goodBot,
        shouldBlock: false,
      };
    }
  }

  // 2. Check for empty or suspiciously short user agent
  if (!userAgent || userAgent.length < 15) {
    return {
      isBot: true,
      reason: "empty-or-short-ua",
      botName: null,
      shouldBlock: true,
    };
  }

  // 3. Check for missing Accept-Language header (strong bot signal)
  // Real browsers always send this header
  if (!acceptLanguage) {
    return {
      isBot: true,
      reason: "missing-accept-language",
      botName: null,
      shouldBlock: true,
    };
  }

  // 4. Check for known bad bot user agents
  for (const botPattern of BOT_USER_AGENTS) {
    if (userAgent.includes(botPattern)) {
      return {
        isBot: true,
        reason: "known-bot-ua",
        botName: botPattern,
        shouldBlock: true,
      };
    }
  }

  // 5. Check for generic bot patterns in UA (not in allowed list)
  const genericBotPatterns = ["bot", "crawler", "spider", "scraper"];
  for (const pattern of genericBotPatterns) {
    if (userAgent.includes(pattern)) {
      return {
        isBot: true,
        reason: "generic-bot-pattern",
        botName: pattern,
        shouldBlock: true,
      };
    }
  }

  // Not a bot (or at least not detectably so)
  return {
    isBot: false,
    reason: null,
    botName: null,
    shouldBlock: false,
  };
}

