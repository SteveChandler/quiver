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
 * Google displays ~60 characters for titles. Truncate long titles
 * to fit while preserving the most important information.
 */
const MAX_TITLE_LENGTH = 60;

function truncateTitleForSEO(title: string, maxLength: number = MAX_TITLE_LENGTH): string {
  if (title.length <= maxLength) {
    return title;
  }
  // Truncate at the last word boundary before maxLength, add ellipsis
  const truncated = title.slice(0, maxLength - 1);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > maxLength * 0.5) {
    return truncated.slice(0, lastSpace) + "…";
  }
  return truncated + "…";
}

/**
 * Build dynamic metadata for beach pages using live forecast data.
 * Falls back to generic titles when forecast data is unavailable.
 *
 * CTR Optimization Strategy (based on competitive research):
 * - Remove "Free" from titles (not present in top-ranking SERPs)
 * - Add forecast duration (7-Day) like competitors (DeepSwell, Surfline)
 * - Add feature mentions (Cams, Conditions) for completeness signal
 * - Keep "Free" in descriptions for conversion/differentiation
 * - Dynamic wave height creates unique SERP snippets
 * - Title length capped at 60 chars for optimal SERP display
 *
 * Competitive patterns:
 * - Surfline: "{Beach} Surf Report, Surf Forecast and Surf Cams - Surfline"
 * - DeepSwell: "{Beach} Surf Report & 15-day Forecast | {Region} Surf Conditions"
 * - Surf-Forecast: "{Beach} Surf Forecast and Surf Reports ({Region}, {Country})"
 */
export function buildDynamicBeachMetadata({
  beach,
  forecast,
}: {
  beach: { name: string; city?: string | null; state?: string | null };
  forecast: { wave_height?: string | null } | null;
}): { title: string; description: string } {
  // Build location context for descriptions and fallback titles
  const locationContext =
    beach.city && beach.state
      ? `${beach.city}, ${beach.state}`
      : beach.city || beach.state || "";

  // CTR-optimized titles matching competitive patterns (no "Free" in titles)
  // For very long beach names, fall back to shorter title formats
  let title: string;
  if (forecast?.wave_height) {
    // Try full title first: "Beach Surf Report: 3-5ft | 7-Day Forecast & Cams"
    const fullTitle = `${beach.name} Surf Report: ${forecast.wave_height} | 7-Day Forecast & Cams`;
    if (fullTitle.length <= MAX_TITLE_LENGTH) {
      title = fullTitle;
    } else {
      // Shortened format for long names: "Beach Surf Report: 3-5ft | Forecast"
      const shortTitle = `${beach.name} Surf Report: ${forecast.wave_height} | Forecast`;
      title = truncateTitleForSEO(shortTitle);
    }
  } else {
    // Try full title first: "Beach Surf Report & Forecast | Location Surf Conditions"
    const fullTitle = `${beach.name} Surf Report & Forecast | ${locationContext || "Local"} Surf Conditions`;
    if (fullTitle.length <= MAX_TITLE_LENGTH) {
      title = fullTitle;
    } else {
      // Shortened format for long names: "Beach Surf Report | Conditions"
      const shortTitle = `${beach.name} Surf Report | ${locationContext || "Local"} Conditions`;
      title = truncateTitleForSEO(shortTitle);
    }
  }

  // CTR-optimized descriptions with "Free" for conversion messaging
  const description = forecast?.wave_height
    ? `${beach.name} is showing ${forecast.wave_height} waves. Free 7-day forecast, tide charts, wind & crowd intel. Updated hourly, no paywall.`
    : `Is ${beach.name} surfable today? Free surf report with wave height, wind, tides & best surf window${locationContext ? ` in ${locationContext}` : ""}. No subscription required.`;

  return { title, description };
}

/**
 * Build dynamic metadata for tide pages using live tide data.
 * Falls back to generic titles when tide data is unavailable.
 *
 * CTR Optimization:
 * - Dynamic "Next High" time creates unique snippets
 * - "Today" targets intent queries
 * - "Free Chart" differentiates from competitors
 */
export function buildDynamicTideMetadata({
  beach,
  tideData,
}: {
  beach: { name: string; city?: string | null; state?: string | null };
  tideData: {
    nextHighTime?: string | null;
    nextLowTime?: string | null;
  } | null;
}): { title: string; description: string } {
  const now = new Date();
  const month = now.toLocaleDateString("en-US", { month: "long" });
  const day = now.getDate();
  const locationContext =
    beach.city && beach.state ? ` in ${beach.city}, ${beach.state}` : "";

  // CTR-optimized title with dynamic tide time when available
  let title: string;
  if (tideData?.nextHighTime) {
    const fullTitle = `${beach.name} Tide Times Today: Next High ${tideData.nextHighTime} | Free Chart`;
    if (fullTitle.length <= MAX_TITLE_LENGTH) {
      title = fullTitle;
    } else {
      const shortTitle = `${beach.name} Tides: High ${tideData.nextHighTime} | Free`;
      title = truncateTitleForSEO(shortTitle);
    }
  } else {
    const fullTitle = `${beach.name} Tide Chart Today | Free High/Low Times`;
    if (fullTitle.length <= MAX_TITLE_LENGTH) {
      title = fullTitle;
    } else {
      const shortTitle = `${beach.name} Tide Chart | Free`;
      title = truncateTitleForSEO(shortTitle);
    }
  }

  // CTR-optimized description with specific times
  const description =
    tideData?.nextHighTime && tideData?.nextLowTime
      ? `${beach.name} tides for ${month} ${day}: High tide at ${tideData.nextHighTime}, low at ${tideData.nextLowTime}. See hourly chart & best surf windows. 100% free.`
      : `Complete tide chart for ${beach.name}${locationContext}. Today's high and low tide times. Hourly predictions and optimal surf windows included. 100% free.`;

  return { title, description };
}

/**
 * Build dynamic metadata for water temperature pages.
 * Falls back to generic titles when temperature data is unavailable.
 *
 * CTR Optimization:
 * - Actual temperature in title is highly clickable
 * - "Wetsuit Guide" adds value proposition
 * - "Today" adds freshness
 */
export function buildDynamicWaterTempMetadata({
  beach,
  waterTempData,
}: {
  beach: { name: string; city?: string | null; state?: string | null };
  waterTempData: {
    tempF?: number | null;
    wetsuitRec?: string | null;
  } | null;
}): { title: string; description: string } {
  const locationContext =
    beach.city && beach.state ? ` in ${beach.city}, ${beach.state}` : "";

  // CTR-optimized title with actual temperature when available
  let title: string;
  if (waterTempData?.tempF) {
    const fullTitle = `${beach.name} Water Temp: ${waterTempData.tempF}°F Today | Wetsuit Guide`;
    if (fullTitle.length <= MAX_TITLE_LENGTH) {
      title = fullTitle;
    } else {
      const shortTitle = `${beach.name} Water Temp: ${waterTempData.tempF}°F | Wetsuit`;
      title = truncateTitleForSEO(shortTitle);
    }
  } else {
    const fullTitle = `${beach.name} Water Temperature Today | Wetsuit Guide`;
    if (fullTitle.length <= MAX_TITLE_LENGTH) {
      title = fullTitle;
    } else {
      const shortTitle = `${beach.name} Water Temp | Wetsuit Guide`;
      title = truncateTitleForSEO(shortTitle);
    }
  }

  // CTR-optimized description with wetsuit recommendation
  const description = waterTempData?.tempF && waterTempData?.wetsuitRec
    ? `${beach.name} water is ${waterTempData.tempF}°F today. ${waterTempData.wetsuitRec} recommended. See seasonal trends and wetsuit thickness guide. 100% free.`
    : `Current water temp at ${beach.name}${locationContext}. Wetsuit recommendation and seasonal trends. Free surf conditions, no paywall.`;

  return { title, description };
}
