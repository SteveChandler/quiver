import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const isProd =
  (process.env.VERCEL_ENV || process.env.NODE_ENV) === "production";
// Allow indexing in development for testing unless explicitly disabled
const disallow = process.env.DISALLOW_ROBOTS === "true";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: disallow
      ? {
          userAgent: "*",
          disallow: "/",
          crawlDelay: 10,
        }
      : {
          userAgent: "*",
          allow: "/",
        },
    sitemap: `${base.replace(/\/$/, "")}/sitemap.xml`,
    host: base.replace(/\/$/, ""),
  };
}
