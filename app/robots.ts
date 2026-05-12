import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const isProd =
  (process.env.VERCEL_ENV || process.env.NODE_ENV) === "production";
// Allow indexing in development for testing unless explicitly disabled
const disallow = process.env.DISALLOW_ROBOTS === "true" || !isProd;
const crawlDisallowRules = [
  "/api/", // Don't crawl API routes (except /api/og/)
  "/admin/", // Private: admin pages
  "/profile/", // Private: user's own profile
  "/sessions/", // Private: user sessions
  "/session/", // Email action routes (confirm/skip) — transactional pages, not for indexing
  "/auth/*", // Auth pages
  "/embed/", // Embeddable widgets (prevent duplicate content)
  "/spots/", // Legacy URL pattern — canonical URLs are hierarchical (state/city/beach); 301 redirects handle traffic but disallowing stops Google from re-indexing old slugs
  "/welcome", // Native app only — not a public web page
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: disallow
      ? {
          userAgent: "*",
          disallow: "/",
          crawlDelay: 10,
        }
      : [
          {
            userAgent: "*",
            allow: "/",
            // Note: /forecast/ is now public and indexable for SEO (regional forecast landing pages)
            disallow: crawlDisallowRules,
          },
          {
            userAgent: "*",
            allow: "/api/og/", // Allow Open Graph image generation
          },
          // AI search crawlers — explicitly allow for GEO (Generative Engine Optimization)
          {
            userAgent: "GPTBot",
            allow: "/",
            disallow: crawlDisallowRules,
            crawlDelay: 2,
          },
          {
            userAgent: "ChatGPT-User",
            allow: "/",
            disallow: crawlDisallowRules,
          },
          {
            userAgent: "OAI-SearchBot",
            allow: "/",
            disallow: crawlDisallowRules,
          },
          {
            userAgent: "ClaudeBot",
            allow: "/",
            disallow: crawlDisallowRules,
            crawlDelay: 2,
          },
          {
            userAgent: "PerplexityBot",
            allow: "/",
            disallow: crawlDisallowRules,
          },
          // Block training-only crawlers
          {
            userAgent: "Bytespider",
            disallow: "/",
          },
        ],
    sitemap: `${base.replace(/\/$/, "")}/sitemap.xml`,
    host: base.replace(/\/$/, ""),
  };
}
