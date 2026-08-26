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
  imageHeight,
  imageWidth,
  keywords,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  imageHeight?: number;
  imageWidth?: number;
  keywords?: string[];
}): Metadata {
  const metadataTitle = titleContainsQuiver(title) ? { absolute: title } : title;
  const canonical = absoluteUrl(path);
  const ogImage = image
    ? absoluteUrl(image)
    : (SEO_CONFIG.openGraph.images?.[0]?.url || "/images/buoy.png");

  return {
    title: metadataTitle,
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
          width: imageWidth ?? 1200,
          height: imageHeight ?? 630,
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

export function titleContainsQuiver(title: string): boolean {
  return /\bQuiver\b/i.test(title);
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
const QUIVER_TITLE_SUFFIX = " | Quiver";
const MAX_DYNAMIC_BEACH_TITLE_LENGTH =
  MAX_TITLE_LENGTH - QUIVER_TITLE_SUFFIX.length;
const MAX_META_DESCRIPTION_LENGTH = 160;

/**
 * Expand state abbreviations for meta tags where full names improve CTR.
 * Only expand PR and HI — CA, OR, WA, FL are widely recognized.
 */
const META_STATE_EXPANSIONS: Record<string, string> = {
  PR: "Puerto Rico",
  HI: "Hawaii",
  TX: "Texas",
  MA: "Massachusetts",
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

export function shortenBeachNameForSerpTitle(name: string): string {
  const normalized = name.replace(/\s+/g, " ").trim();
  const firstSegment = normalized.split("/")[0]?.trim() ?? "";
  const withoutParenthetical = firstSegment
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return withoutParenthetical || firstSegment || normalized;
}

function fitDynamicBeachTitle(
  baseTitle: string,
  city: string | null | undefined,
  state?: string | null | undefined,
): string {
  const suffixes = new Set<string>();
  if (city) suffixes.add(city);
  if (state) {
    const rawState = state.toUpperCase();
    const expandedState = expandStateForMeta(state);
    suffixes.add(expandedState);
    suffixes.add(rawState);
  }

  for (const suffix of suffixes) {
    const withSuffix = `${baseTitle} | ${suffix}`;
    if (withSuffix.length <= MAX_DYNAMIC_BEACH_TITLE_LENGTH) {
      return withSuffix;
    }
  }

  return truncateTitleForSEO(baseTitle, MAX_DYNAMIC_BEACH_TITLE_LENGTH);
}

function truncateDescriptionForSEO(
  description: string,
  maxLength: number = MAX_META_DESCRIPTION_LENGTH,
): string {
  if (description.length <= maxLength) {
    return description;
  }

  const trimmed = description.slice(0, maxLength - 1);
  const lastSpace = trimmed.lastIndexOf(" ");
  const boundary = lastSpace > maxLength * 0.6 ? lastSpace : maxLength - 1;
  return `${trimmed.slice(0, boundary).replace(/[,\s]+$/, "")}.`;
}

function pickMetaDescription(candidates: string[]): string {
  return candidates.find((candidate) => candidate.length <= MAX_META_DESCRIPTION_LENGTH)
    ?? truncateDescriptionForSEO(candidates[candidates.length - 1] ?? "");
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
    ["punchy", "Punchy"],
    ["heavy", "Heavy"],
    ["clean", "Clean"],
  ];
  for (const [pattern, label] of keywords) {
    if (new RegExp(pattern, "i").test(waveTips)) return label;
  }
  return null;
}

/**
 * Converts crowd_level into a concise SERP signal.
 * Exported for unit testing.
 *
 * Phrases chosen for inline SERP readability ("0.8 ft · Packed"):
 * - very_heavy → "Packed"   (avoidance signal for crowd-sensitive surfers)
 * - heavy      → "Crowded"  (honest surf-culture term)
 * - moderate   → "Busy"     (soft warning, not a deterrent)
 * - light      → "Uncrowded" (positive differentiator)
 */
export function formatCrowdSignal(crowdLevel: string | null | undefined): string | null {
  if (!crowdLevel) return null;
  const lvl = crowdLevel.toLowerCase();
  if (lvl === "light") return "Uncrowded";
  if (lvl === "moderate") return "Busy";
  if (lvl === "heavy") return "Crowded";
  if (lvl === "very_heavy") return "Packed";
  return null;
}

/**
 * Builds a location suffix for beach page titles, trying progressively shorter formats.
 * Tries: "| {City}, {ExpandedState}" -> "| {City}, {ST}" -> "| {City}" -> "| {ST}" -> ""
 */
function buildTitleLocationSuffix(
  coreText: string,
  city: string | null | undefined,
  state: string | null | undefined,
): string {
  if (!city && !state) return "";
  const expandedState = state ? expandStateForMeta(state) : null;

  if (city && expandedState) {
    const suffix1 = ` | ${city}, ${expandedState}`;
    if ((coreText + suffix1).length <= MAX_TITLE_LENGTH) return suffix1;
  }
  if (city && state && state !== expandedState) {
    const suffix2 = ` | ${city}, ${state}`;
    if ((coreText + suffix2).length <= MAX_TITLE_LENGTH) return suffix2;
  }
  if (city) {
    const suffix3 = ` | ${city}`;
    if ((coreText + suffix3).length <= MAX_TITLE_LENGTH) return suffix3;
  }
  if (state) {
    const suffix4 = ` | ${state}`;
    if ((coreText + suffix4).length <= MAX_TITLE_LENGTH) return suffix4;
  }
  return "";
}

const WEAK_TRAILING_WORDS = /\s+(the|a|an|for|in|at|to|of|that|but|with|and|or|by|on|from)$/i;

/**
 * Extracts a clean description snippet from wave_tips text.
 * Prefers whole sentences; falls back to clause boundaries; strips weak trailing words.
 * Exported for testing.
 */
export function extractDescriptionSnippet(
  waveTips: string,
  budget: number,
): string {
  if (!waveTips || budget <= 0) return "";

  // Split on sentence boundaries (". " or ".\n"), not bare "."
  const sentences = waveTips.split(/\.\s+/);
  // Strip any trailing period from the first element (happens when input ends with ".")
  const first = sentences[0].trim().replace(/\.$/, "");

  let snippet: string;

  if (first.length <= budget) {
    snippet = first;
  } else {
    // Try clause boundaries in order of preference
    const clauseBreaks = [";", " — ", " – "];
    let truncated = "";
    for (const sep of clauseBreaks) {
      const idx = first.indexOf(sep);
      if (idx > 0 && idx <= budget) {
        truncated = first.slice(0, idx);
        break;
      }
    }
    if (!truncated) {
      // Last resort: word boundary
      const cut = first.slice(0, budget);
      const lastSpace = cut.lastIndexOf(" ");
      truncated = lastSpace > budget * 0.5 ? cut.slice(0, lastSpace) : cut;
    }
    snippet = truncated;
  }

  // Strip weak trailing words before punctuating
  snippet = snippet.replace(WEAK_TRAILING_WORDS, "").trim();

  if (!snippet) return "";

  // Capitalize first character
  return snippet.charAt(0).toUpperCase() + snippet.slice(1);
}

/**
 * Build dynamic metadata for beach pages using live forecast data.
 * Falls back to generic titles when forecast data is unavailable.
 *
 * CTR strategy:
 * - Keep titles short enough for Next's global " | Quiver" suffix.
 * - Prefer "{shortBeach}: {height} Surf Report & Forecast", adding location
 *   only if it fits.
 * - Use stable descriptions that create click incentive without fragmenting.
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
  forecast: {
    wave_height?: string | null;
    dayLabel?: "today" | "tomorrow" | null;
  } | null;
}): { title: string; description: string } {
  const expandedState = beach.state ? expandStateForMeta(beach.state) : "";
  const locationText =
    beach.city && expandedState
      ? `${beach.city}, ${expandedState}`
      : beach.city || expandedState || "";
  const locationContext = locationText ? ` in ${locationText}` : "";
  const shortBeachName = shortenBeachNameForSerpTitle(beach.name);

  if (forecast?.wave_height) {
    const dayLabel = forecast.dayLabel;
    const title = fitDynamicBeachTitle(
      `${shortBeachName}: ${forecast.wave_height} Surf Report & Forecast`,
      beach.city,
      beach.state,
    );
    const description = dayLabel
      ? pickMetaDescription([
          `${dayLabel === "tomorrow" ? "Tomorrow's" : "Current"} ${forecast.wave_height} wave height at ${beach.name}. See the ${dayLabel} surf report & forecast, wind, tide, crowd intel, and 7-day forecast.`,
          `${dayLabel === "tomorrow" ? "Tomorrow's" : "Current"} ${forecast.wave_height} wave height at ${shortBeachName}. See the ${dayLabel} surf report & forecast, wind, tide, crowd intel, and 7-day forecast.`,
          `${forecast.wave_height} surf report & forecast for ${shortBeachName}: wave height, wind, tide, crowd intel, and 7-day forecast.`,
        ])
      : pickMetaDescription([
          `Current ${forecast.wave_height} wave height at ${beach.name}. See today's surf report & forecast, wind, tide, crowd intel, and 7-day forecast.`,
          `Current ${forecast.wave_height} wave height at ${shortBeachName}. See today's surf report & forecast, wind, tide, crowd intel, and 7-day forecast.`,
          `${forecast.wave_height} surf report & forecast for ${shortBeachName}: wave height, wind, tide, crowd intel, and 7-day forecast.`,
        ]);

    return { title, description };
  }

  const title = fitDynamicBeachTitle(
    `${shortBeachName} Surf Report & Forecast`,
    beach.city,
    beach.state,
  );
  const description = pickMetaDescription([
    `Today's surf report & forecast for ${beach.name}${locationContext}: wave height, wind, tide, crowd intel, and 7-day forecast.`,
    `Today's surf report & forecast for ${shortBeachName}${locationContext}: wave height, wind, tide, crowd intel, and 7-day forecast.`,
    `${shortBeachName} surf report & forecast: wave height, wind, tide, crowd intel, and 7-day forecast.`,
  ]);

  return { title, description };
}

/**
 * Builds the tier-3 no-forecast title fallback.
 * Format: "{Beach} — {Break} | {location or CrowdSignal}" or "{Beach} | {location or 'Surf Report'}"
 */
function buildNoForecastTier3(
  beachName: string,
  breakType: string | null | undefined,
  crowdSignal: string | null,
  city: string | null | undefined,
  state?: string | null | undefined,
): string {
  if (breakType) {
    const core = `${beachName} — ${capitalizeBreakType(breakType)}`;
    const locationSuffix = buildTitleLocationSuffix(core, city, state);
    if (locationSuffix) return core + locationSuffix;
    if (crowdSignal) return `${core} | ${crowdSignal}`;
    return core;
  }
  const base = beachName;
  const locationSuffix = buildTitleLocationSuffix(base, city, state);
  if (locationSuffix) return base + locationSuffix;
  if (crowdSignal) return `${base} | ${crowdSignal}`;
  return `${base} | Surf Report`;
}

/**
 * Build dynamic metadata for tide pages using live tide data.
 * Falls back to generic titles when tide data is unavailable.
 *
 * CTR Optimization — 4th iteration:
 *
 * Failed framings (iterations 1-3):
 * - v1 "Best Tide to Surf {Beach}" — 0% CTR on 1,200+ impressions. Didn't match
 *   the dominant query pattern "{beach} tide chart today".
 * - v2 "{Beach} Tide Chart | High 5.2ft at 2:15 PM" — gave away the answer Google
 *   already surfaces in its knowledge panel; zero click incentive.
 * - v3 "{Beach} Tide Chart & Surf Windows | {Mon YYYY}" — better query match but
 *   "Surf Windows" is jargon that doesn't create urgency or curiosity.
 *
 * Current strategy (v4): query-match anchor + planning signal
 * - Keep "Tide Chart" as the anchor term (matches dominant query intent).
 * - Add planning signal via em dash: "— When to Surf" frames the page as a
 *   decision-making tool, not just a data display.
 * - Descriptions avoid exact tide times/heights so the SERP does not fully
 *   answer the planning question.
 * - Month+Year date token keeps title fresh without encoding daily-volatile data.
 */
export function buildDynamicTideMetadata({
  beach,
  tideData,
}: {
  beach: { name: string; city?: string | null; state?: string | null };
  tideData: {
    nextHighTime?: string | null;
    nextLowTime?: string | null;
    nextHighHeight?: number | null;
    nextLowHeight?: number | null;
  } | null;
}): { title: string; description: string } {
  const now = new Date();
  const monthYear = now.toLocaleDateString("en-US", { month: "short", year: "numeric" });

  // Title: query-match anchor "Tide Chart" + planning signal "When to Surf"
  // Tier 1: "{Beach} Tide Chart — When to Surf | {Mon YYYY}" (if <=60 chars)
  // Tier 2: "{Beach} Tide Chart — When to Surf" (drop date, if <=60 chars)
  // Tier 3: "{Beach} Tide Chart" (very long names)
  const tier1 = `${beach.name} Tide Chart \u2014 When to Surf | ${monthYear}`;
  const tier2 = `${beach.name} Tide Chart \u2014 When to Surf`;
  const tier3 = `${beach.name} Tide Chart`;
  let title: string;
  if (tier1.length <= MAX_TITLE_LENGTH) {
    title = tier1;
  } else if (tier2.length <= MAX_TITLE_LENGTH) {
    title = tier2;
  } else {
    title = truncateTitleForSEO(tier3);
  }

  const shortBeachName = shortenBeachNameForSerpTitle(beach.name);
  const description = pickMetaDescription([
    `Should you surf ${beach.name} on incoming or outgoing tide? See today's 2-3 hour tide windows, chart, and 7-day surf timing.`,
    `Should you surf ${shortBeachName} on incoming or outgoing tide? See today's 2-3 hour tide windows, chart, and 7-day surf timing.`,
    `See today's tide chart for ${shortBeachName}: 2-3 hour surf windows, tide timing, and 7-day surf context.`,
  ]);

  return { title, description };
}

/**
 * Build dynamic metadata for water temperature pages.
 * Falls back to generic titles when temperature data is unavailable.
 *
 * CTR Optimization — 4th iteration:
 *
 * Current strategy: answer-first title and description.
 * GSC showed top-10 water-temp pages with weak CTR, so the SERP copy now
 * matches the dominant "water temperature today" query and pairs the answer
 * with wetsuit guidance plus a surf-report handoff.
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
  const shortBeachName = shortenBeachNameForSerpTitle(beach.name);
  const tempF = waterTempData?.tempF;
  const title =
    tempF != null
      ? truncateTitleForSEO(`${beach.name} Water Temperature Today: ${tempF}°F`)
      : truncateTitleForSEO(`${beach.name} Water Temperature Today | Wetsuit Guide`);

  const description =
    tempF != null
      ? pickMetaDescription([
          `${beach.name} water temperature today is ${tempF}°F. Wetsuit guidance, seasonal trends, and surf report links before you paddle out.`,
          `${shortBeachName} water temp today is ${tempF}°F. Wetsuit guidance, seasonal trends, and surf report links before you paddle out.`,
        ])
      : pickMetaDescription([
          `Current water temperature, wetsuit guidance, seasonal trends, and surf report links for ${beach.name} before you paddle out.`,
          `Current water temp, wetsuit guidance, seasonal trends, and surf report links for ${shortBeachName}.`,
        ]);

  return { title, description };
}
