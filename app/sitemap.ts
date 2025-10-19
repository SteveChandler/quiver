import type { MetadataRoute } from "next";

const baseUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
).replace(/\/$/, "");

export const dynamic = "force-dynamic" as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const lastmod = now.toISOString();

  const staticRoutes: MetadataRoute.Sitemap = [
    "/",
    "/features",
    "/about",
    "/privacy",
    "/map",
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: lastmod,
    changeFrequency: "daily",
    priority: route === "/" ? 1 : 0.7,
  }));

  // Dynamic beaches and forecasts
  let beachEntries: MetadataRoute.Sitemap = [];
  let forecastEntries: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${baseUrl}/api/beaches`, {
      // Revalidate daily to keep sitemap fresh without heavy load
      next: { revalidate: 86400 },
    });
    if (res.ok) {
      const json = await res.json();
      const beaches: Array<{ id: string; updated_at?: string | null }> =
        json?.beaches || json?.data || [];
      
      beachEntries = beaches.map((b) => ({
        url: `${baseUrl}/beach/${b.id}`,
        lastModified: b.updated_at || lastmod,
        changeFrequency: "weekly",
        priority: 0.6,
      }));

      // Add forecast pages for each beach
      forecastEntries = beaches.map((b) => ({
        url: `${baseUrl}/forecast/${b.id}`,
        lastModified: b.updated_at || lastmod,
        changeFrequency: "daily",
        priority: 0.8, // High priority for forecast pages
      }));
    }
  } catch {
    // Fail silently; return static routes only
  }

  return [...staticRoutes, ...beachEntries, ...forecastEntries];
}
