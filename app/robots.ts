import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const isProd =
  (process.env.VERCEL_ENV || process.env.NODE_ENV) === "production";
// Allow indexing in development for testing unless explicitly disabled
const disallow = process.env.DISALLOW_ROBOTS === "true" || !isProd;

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
            disallow: [
              "/_next/", // Don't crawl Next.js build assets
              "/api/", // Don't crawl API routes (except /api/og/)
              "/admin/", // Private: admin pages
              "/profile/", // Private: user's own profile
              "/inbox/", // Private: notifications
              "/sessions/", // Private: user sessions
              "/session/", // Email action routes (confirm/skip) — transactional pages, not for indexing
              "/auth/*", // Auth pages
              "/embed/", // Embeddable widgets (prevent duplicate content)
              "/spots/", // Legacy URL pattern — canonical URLs are hierarchical (state/city/beach); 301 redirects handle traffic but disallowing stops Google from re-indexing old slugs
              "/welcome", // Native app only — not a public web page
            ],
          },
          {
            userAgent: "*",
            allow: "/api/og/", // Allow Open Graph image generation
          },
        ],
    sitemap: `${base.replace(/\/$/, "")}/sitemap.xml`,
    host: base.replace(/\/$/, ""),
  };
}
