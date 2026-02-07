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
      site: SEO_CONFIG.twitter.site,
      creator: SEO_CONFIG.twitter.creator,
      title,
      description,
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
 * - No "Free" in titles or descriptions — focus on data richness
 * - Add forecast duration (7-Day) like competitors (DeepSwell, Surfline)
 * - Include break_type + skill_level for identity signal
 * - Add state abbreviation when title has room (under 60 chars)
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
  beach: {
    name: string;
    city?: string | null;
    state?: string | null;
    break_type?: string | null;
    skill_level?: string | null;
  };
  forecast: { wave_height?: string | null } | null;
}): { title: string; description: string } {
  // Build location context for descriptions and fallback titles
  const locationContext =
    beach.city && beach.state
      ? `${beach.city}, ${beach.state}`
      : beach.city || beach.state || "";

  // Helper: try to insert state abbreviation into title when there's room
  function withState(base: string, suffix: string): string {
    if (!beach.state) return `${base} | ${suffix}`;
    const withSt = `${base} | ${beach.state} | ${suffix}`;
    if (withSt.length <= MAX_TITLE_LENGTH) return withSt;
    return `${base} | ${suffix}`;
  }

  // Build title with state abbreviation when room allows
  let title: string;
  if (forecast?.wave_height) {
    const base = `${beach.name} Surf Report: ${forecast.wave_height}`;
    const fullTitle = withState(base, "7-Day Forecast");
    if (fullTitle.length <= MAX_TITLE_LENGTH) {
      title = fullTitle;
    } else {
      const shortTitle = `${base} | Forecast`;
      title = truncateTitleForSEO(shortTitle);
    }
  } else {
    const fullTitle = `${beach.name} Surf Report & Forecast | ${locationContext || "Local"} Surf Conditions`;
    if (fullTitle.length <= MAX_TITLE_LENGTH) {
      title = fullTitle;
    } else {
      const shortTitle = `${beach.name} Surf Report | ${locationContext || "Local"} Conditions`;
      title = truncateTitleForSEO(shortTitle);
    }
  }

  // Build description with break_type + skill_level when available
  const hasBreakInfo = beach.break_type && beach.skill_level;
  let description: string;

  if (forecast?.wave_height) {
    description = hasBreakInfo
      ? `${beach.name} is a ${beach.skill_level}-level ${beach.break_type} in ${locationContext || "the area"} showing ${forecast.wave_height} waves. 7-day forecast, tide charts, wind & crowd intel. Updated hourly.`
      : `${beach.name} is showing ${forecast.wave_height} waves. 7-day forecast, tide charts, wind & crowd intel. Updated hourly.`;
  } else {
    description = hasBreakInfo
      ? `${beach.name} is a ${beach.skill_level}-level ${beach.break_type} in ${locationContext || "the area"}. Surf report with wave height, wind, tides & best surf window. No paywall.`
      : `Is ${beach.name} surfable today? Surf report with wave height, wind, tides & best surf window${locationContext ? ` in ${locationContext}` : ""}. No subscription required.`;
  }

  return { title, description };
}

/**
 * Build dynamic metadata for tide pages using live tide data.
 * Falls back to generic titles when tide data is unavailable.
 *
 * CTR Optimization:
 * - Dynamic "Next High" time creates unique snippets
 * - Specific date (e.g. "Feb 7") targets date-specific queries
 * - No "Free" — focus on data richness and freshness
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
  const monthDay = now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const locationContext =
    beach.city && beach.state ? ` in ${beach.city}, ${beach.state}` : "";

  // CTR-optimized title with date and dynamic tide time
  let title: string;
  if (tideData?.nextHighTime) {
    const fullTitle = `${beach.name} Tides ${monthDay}: Next High ${tideData.nextHighTime} | Chart`;
    if (fullTitle.length <= MAX_TITLE_LENGTH) {
      title = fullTitle;
    } else {
      const shortTitle = `${beach.name} Tides ${monthDay}: High ${tideData.nextHighTime}`;
      title = truncateTitleForSEO(shortTitle);
    }
  } else {
    const fullTitle = `${beach.name} Tide Chart ${monthDay} | High & Low Times`;
    if (fullTitle.length <= MAX_TITLE_LENGTH) {
      title = fullTitle;
    } else {
      const shortTitle = `${beach.name} Tides ${monthDay} | Chart`;
      title = truncateTitleForSEO(shortTitle);
    }
  }

  // Description with specific times and date
  const description =
    tideData?.nextHighTime && tideData?.nextLowTime
      ? `${beach.name} tides for ${month} ${day}: High tide at ${tideData.nextHighTime}, low at ${tideData.nextLowTime}. Hourly chart & best surf windows.`
      : `${beach.name} tide chart for ${month} ${day}${locationContext}. Today's high and low tide times. Hourly predictions and optimal surf windows.`;

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
    ? `${beach.name} water is ${waterTempData.tempF}°F today. ${waterTempData.wetsuitRec} recommended. Seasonal trends and wetsuit thickness guide.`
    : `Current water temp at ${beach.name}${locationContext}. Wetsuit recommendation and seasonal trends. No subscription required.`;

  return { title, description };
}

