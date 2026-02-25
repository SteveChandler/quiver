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

/**
 * Expand state abbreviations for meta tags where full names improve CTR.
 * Only expand PR and HI — CA, OR, WA, FL are widely recognized.
 */
const META_STATE_EXPANSIONS: Record<string, string> = {
  PR: "Puerto Rico",
  HI: "Hawaii",
};

export function expandStateForMeta(state: string): string {
  return META_STATE_EXPANSIONS[state.toUpperCase()] ?? state;
}

export function truncateTitleForSEO(title: string, maxLength: number = MAX_TITLE_LENGTH): string {
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
 * Capitalize break type for display in titles.
 * e.g., "point" -> "Point Break", "reef" -> "Reef Break", "beach" -> "Beach Break"
 */
function capitalizeBreakType(breakType: string): string {
  const first = breakType.charAt(0).toUpperCase() + breakType.slice(1).toLowerCase();
  return `${first} Break`;
}

/**
 * Abbreviate break type for compact titles.
 * Returns a short label without "Break" suffix for common types.
 */
function shortBreakType(breakType: string): string {
  const bt = breakType.toLowerCase();
  if (bt === "beach") return "Beach";
  if (bt === "reef") return "Reef";
  if (bt === "point") return "Point";
  if (bt === "river mouth" || bt === "rivermouth") return "Rivermouth";
  return capitalizeBreakType(breakType).replace(" Break", "");
}

/**
 * Extracts a short wave character descriptor from wave_tips text.
 * Returns the first keyword match (case-insensitive), or null.
 */
function extractWaveCharacter(waveTips: string | null | undefined): string | null {
  if (!waveTips) return null;
  const keywords: Array<[string, string]> = [
    ["hollow", "Hollow"],
    ["powerful", "Powerful"],
    ["fast", "Fast"],
    ["long", "Long"],
    ["mellow", "Mellow"],
    ["steep", "Steep"],
    ["barreling", "Barreling"],
    ["peeling", "Peeling"],
  ];
  for (const [pattern, label] of keywords) {
    if (new RegExp(pattern, "i").test(waveTips)) return label;
  }
  return null;
}

/**
 * Converts crowd_level into a concise SERP signal.
 * "moderate" is not a differentiator — returns null.
 */
function formatCrowdSignal(crowdLevel: string | null | undefined): string | null {
  if (!crowdLevel) return null;
  const lvl = crowdLevel.toLowerCase();
  if (lvl === "light") return "Uncrowded";
  if (lvl === "heavy") return "Popular";
  return null;
}

/**
 * Build dynamic metadata for beach pages using live forecast data.
 * Falls back to generic titles when forecast data is unavailable.
 *
 * CTR Optimization Strategy (based on competitive research):
 * - No "Free" in titles or descriptions — focus on data richness
 * - Add forecast duration (7-Day) like competitors (DeepSwell, Surfline)
 * - Include break_type + skill_level for identity signal
 * - Wave character extracted from wave_tips creates unique SERP snippets
 * - Crowd signal ("Uncrowded" / "Popular") as differentiator in no-forecast titles
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
    description_excerpt?: string | null;
    wave_tips?: string | null;
    crowd_level?: string | null;
    average_rating?: number | null;
    review_count?: number | null;
  };
  forecast: { wave_height?: string | null } | null;
}): { title: string; description: string } {
  // Build location context for descriptions and fallback titles
  const expandedState = beach.state ? expandStateForMeta(beach.state) : "";
  const locationContext =
    beach.city && expandedState
      ? `${beach.city}, ${expandedState}`
      : beach.city || expandedState || "";

  const waveChar = extractWaveCharacter(beach.wave_tips);
  const crowdSignal = formatCrowdSignal(beach.crowd_level);
  // Capitalize skill_level for title use (DB stores lowercase)
  const skill = beach.skill_level
    ? beach.skill_level.charAt(0).toUpperCase() + beach.skill_level.slice(1).toLowerCase()
    : null;

  // Build title — differentiate from Surfline with unique value signals
  let title: string;

  if (forecast?.wave_height) {
    // WITH forecast: 3-tier fallback
    // Tier 1: {Beach}: {height} — {WaveChar} {BreakShort} | {City}
    if (waveChar && beach.break_type && beach.city) {
      const t1 = `${beach.name}: ${forecast.wave_height} — ${waveChar} ${shortBreakType(beach.break_type)} | ${beach.city}`;
      if (t1.length <= MAX_TITLE_LENGTH) {
        title = t1;
      } else if (skill && beach.break_type) {
        // Tier 2: {Beach}: {height} — {Skill} {BreakShort}
        const t2 = `${beach.name}: ${forecast.wave_height} — ${skill} ${shortBreakType(beach.break_type)}`;
        title = truncateTitleForSEO(t2.length <= MAX_TITLE_LENGTH ? t2 : `${beach.name}: ${forecast.wave_height} Today | Surf Report`);
      } else {
        // Tier 3: {Beach}: {height} Today | Surf Report
        title = truncateTitleForSEO(`${beach.name}: ${forecast.wave_height} Today | Surf Report`);
      }
    } else if (skill && beach.break_type) {
      // Tier 2: {Beach}: {height} — {Skill} {BreakShort}
      const t2 = `${beach.name}: ${forecast.wave_height} — ${skill} ${shortBreakType(beach.break_type)}`;
      if (t2.length <= MAX_TITLE_LENGTH) {
        title = t2;
      } else {
        // Tier 3
        title = truncateTitleForSEO(`${beach.name}: ${forecast.wave_height} Today | Surf Report`);
      }
    } else {
      // Tier 3: {Beach}: {height} Today | Surf Report
      title = truncateTitleForSEO(`${beach.name}: ${forecast.wave_height} Today | Surf Report`);
    }
  } else {
    // WITHOUT forecast: 3-tier fallback
    // Tier 1: {Beach} — {Skill} {WaveChar} {BreakShort} | {City}
    if (skill && waveChar && beach.break_type && beach.city) {
      const t1 = `${beach.name} — ${skill} ${waveChar} ${shortBreakType(beach.break_type)} | ${beach.city}`;
      if (t1.length <= MAX_TITLE_LENGTH) {
        title = t1;
      } else if (skill && beach.break_type) {
        // Tier 2: {Beach} — {Skill} {Break} | {City} (full capitalizeBreakType)
        const t2City = beach.city ? ` | ${beach.city}` : "";
        const t2 = `${beach.name} — ${skill} ${capitalizeBreakType(beach.break_type)}${t2City}`;
        title = truncateTitleForSEO(t2.length <= MAX_TITLE_LENGTH ? t2 : buildNoForecastTier3(beach.name, beach.break_type, crowdSignal, beach.city));
      } else {
        title = truncateTitleForSEO(buildNoForecastTier3(beach.name, beach.break_type, crowdSignal, beach.city));
      }
    } else if (skill && beach.break_type) {
      // Tier 2: {Beach} — {Skill} {Break} | {City}
      const t2City = beach.city ? ` | ${beach.city}` : "";
      const t2 = `${beach.name} — ${skill} ${capitalizeBreakType(beach.break_type)}${t2City}`;
      if (t2.length <= MAX_TITLE_LENGTH) {
        title = t2;
      } else {
        title = truncateTitleForSEO(buildNoForecastTier3(beach.name, beach.break_type, crowdSignal, beach.city));
      }
    } else {
      // Tier 3
      title = truncateTitleForSEO(buildNoForecastTier3(beach.name, beach.break_type, crowdSignal, beach.city));
    }
  }

  // Build description
  const MAX_DESC = 160;
  const ratingSignal =
    beach.average_rating != null &&
    beach.average_rating >= 4.0 &&
    beach.review_count != null &&
    beach.review_count >= 3
      ? `Rated ${beach.average_rating.toFixed(1)}/5.`
      : null;

  let description: string;

  if (forecast?.wave_height) {
    // WITH forecast description
    const close = "7-day forecast, crowd intel & optimal surf windows.";
    let mid = "";
    if (beach.wave_tips) {
      // First sentence of wave_tips, capped at 60 chars at word boundary
      const firstSentence = beach.wave_tips.split(".")[0].trim();
      let waveSentence = firstSentence;
      if (firstSentence.length > 60) {
        const truncated = firstSentence.slice(0, 60);
        const lastSpace = truncated.lastIndexOf(" ");
        waveSentence = lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated;
      }
      // Capitalize first character for proper sentence start in descriptions
      if (waveSentence) {
        waveSentence = waveSentence.charAt(0).toUpperCase() + waveSentence.slice(1);
      }
      mid = waveSentence ? ` ${waveSentence}.` : "";
    } else if (beach.break_type && beach.skill_level) {
      mid = ` ${capitalizeBreakType(beach.break_type)} for ${beach.skill_level} surfers.`;
    }

    const base = `${forecast.wave_height} at ${beach.name}.${mid}`;
    const withRating = ratingSignal ? `${base} ${ratingSignal} ${close}` : `${base} ${close}`;
    if (withRating.length <= MAX_DESC) {
      description = withRating;
    } else {
      // Drop rating
      const withoutRating = `${base} ${close}`;
      description = withoutRating.length <= MAX_DESC ? withoutRating : withoutRating.slice(0, MAX_DESC);
    }
  } else {
    // WITHOUT forecast description
    const close = "Live forecast, tide chart & surf windows.";
    let opener = "";
    if (beach.description_excerpt) {
      const raw = beach.description_excerpt;
      opener = raw.length > 80 ? raw.slice(0, 77) + "..." : raw;
    } else {
      opener = `${beach.name} in ${locationContext || "the area"}.`;
    }

    const crowdPart = crowdSignal ? ` ${crowdSignal}.` : "";
    const ratingPart = ratingSignal ? ` ${ratingSignal}` : "";

    const full = `${opener}${crowdPart}${ratingPart} ${close}`;
    if (full.length <= MAX_DESC) {
      description = full;
    } else {
      // Drop rating first
      const withoutRating = `${opener}${crowdPart} ${close}`;
      if (withoutRating.length <= MAX_DESC) {
        description = withoutRating;
      } else {
        // Drop crowd signal too
        const withoutBoth = `${opener} ${close}`;
        description = withoutBoth.length <= MAX_DESC ? withoutBoth : withoutBoth.slice(0, MAX_DESC);
      }
    }
  }

  return { title, description };
}

/**
 * Builds the tier-3 no-forecast title fallback.
 * Format: "{Beach} — {Break} | {CrowdSignal or City}" or "{Beach} | {CrowdSignal or City or 'Surf Report'}"
 */
function buildNoForecastTier3(
  beachName: string,
  breakType: string | null | undefined,
  crowdSignal: string | null,
  city: string | null | undefined,
): string {
  const trailing = crowdSignal ?? city ?? "Surf Report";
  if (breakType) {
    return `${beachName} — ${capitalizeBreakType(breakType)} | ${trailing}`;
  }
  return `${beachName} | ${trailing}`;
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
    : `Current water temp at ${beach.name}${locationContext}. Wetsuit recommendation and seasonal trends. Updated daily with live buoy data.`;

  return { title, description };
}

