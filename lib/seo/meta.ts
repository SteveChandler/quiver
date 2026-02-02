import type { Metadata } from "next";
import { SEO_CONFIG } from "@/lib/constants/seo";

const baseUrlString =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

function absoluteUrl(path: string): string {
  try {
    const url = new URL(path, baseUrlString);
    return url.toString();
  } catch {
    return `${baseUrlString.replace(/\/$/, "")}${
      path.startsWith("/") ? "" : "/"
    }${path}`;
  }
}

export function buildPageMetadata({
  title,
  description,
  path,
  image,
  keywords,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  keywords?: string[];
}): Metadata {
  const canonical = absoluteUrl(path);
  const ogImage = image
    ? absoluteUrl(image)
    : (SEO_CONFIG.openGraph.images?.[0]?.url || "/images/buoy.png");

  return {
    title,
    description,
    keywords: keywords || [...SEO_CONFIG.keywords],
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SEO_CONFIG.openGraph.siteName,
      type: SEO_CONFIG.openGraph.type as any,
      locale: SEO_CONFIG.openGraph.locale,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: SEO_CONFIG.twitter.card as any,
      title,
      description,
      site: SEO_CONFIG.twitter.site,
      creator: SEO_CONFIG.twitter.creator,
      images: [ogImage],
    },
    robots: {
      index: shouldIndex(),
      follow: shouldIndex(),
      googleBot: {
        index: shouldIndex(),
        follow: shouldIndex(),
      },
    },
  } satisfies Metadata;
}

export function formatMetaDate(date = new Date()): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function shouldIndex(): boolean {
  return process.env.DISALLOW_ROBOTS !== "true";
}

/**
 * Build dynamic metadata for beach pages using live forecast data.
 * Falls back to generic titles when forecast data is unavailable.
 */
export function buildDynamicBeachMetadata({
  beach,
  forecast,
}: {
  beach: { name: string; city?: string | null; state?: string | null };
  forecast: { wave_height?: string | null } | null;
}): { title: string; description: string } {
  const locationContext =
    beach.city && beach.state ? ` in ${beach.city}, ${beach.state}` : "";

  const title = forecast?.wave_height
    ? `${beach.name} Surf Report: ${forecast.wave_height} Today | Live Forecast`
    : `${beach.name} Surf Report & Forecast | Updated Live`;

  const description = forecast?.wave_height
    ? `${beach.name} is ${forecast.wave_height} right now. See the best window to paddle out today${locationContext}. Free, no paywall.`
    : `${beach.name} surf report for ${formatMetaDate()}. Wave height, swell, wind, and tide conditions${locationContext}.`;

  return { title, description };
}
