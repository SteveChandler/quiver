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
 * CTR Optimization Strategy (based on competitive research):
 * - No "Free" in titles or descriptions — focus on data richness
 * - Add forecast duration (7-Day) like competitors (DeepSwell, Surfline)
 * - Include break_type + skill_level for identity signal
 * - Wave character extracted from wave_tips creates unique SERP snippets
 * - Crowd signal ("Uncrowded" / "Popular") as differentiator in no-forecast titles
 * - Title length capped at 60 chars for optimal SERP display
 * - Location context appended to all title tiers via buildTitleLocationSuffix
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
    // WITH forecast: 3-tier fallback, each tier appends best-fitting location suffix

    // Tier 1 core: {Beach}: {height} — {WaveChar} {BreakShort}
    if (waveChar && beach.break_type) {
      const t1Core = `${beach.name}: ${forecast.wave_height} — ${waveChar} ${shortBreakType(beach.break_type)}`;
      const t1Suffix = buildTitleLocationSuffix(t1Core, beach.city, beach.state);
      const t1 = t1Core + t1Suffix;
      if (t1.length <= MAX_TITLE_LENGTH) {
        title = t1;
      } else if (t1Core.length <= MAX_TITLE_LENGTH) {
        title = t1Core;
      } else if (skill && beach.break_type) {
        // Tier 2: {Beach}: {height} — {Skill} {BreakShort}
        const t2Core = `${beach.name}: ${forecast.wave_height} — ${skill} ${shortBreakType(beach.break_type)}`;
        const t2Suffix = buildTitleLocationSuffix(t2Core, beach.city, beach.state);
        const t2 = t2Core + t2Suffix;
        const t2Best = t2.length <= MAX_TITLE_LENGTH ? t2 : (t2Core.length <= MAX_TITLE_LENGTH ? t2Core : `${beach.name}: ${forecast.wave_height} Today | Surf Report`);
        title = truncateTitleForSEO(t2Best);
      } else {
        // Tier 3
        const t3Core = `${beach.name}: ${forecast.wave_height} Today`;
        const t3Suffix = buildTitleLocationSuffix(t3Core, beach.city, beach.state);
        title = truncateTitleForSEO(t3Suffix ? t3Core + t3Suffix : `${t3Core} | Surf Report`);
      }
    } else if (skill && beach.break_type) {
      // Tier 2: {Beach}: {height} — {Skill} {BreakShort}
      const t2Core = `${beach.name}: ${forecast.wave_height} — ${skill} ${shortBreakType(beach.break_type)}`;
      const t2Suffix = buildTitleLocationSuffix(t2Core, beach.city, beach.state);
      const t2 = t2Core + t2Suffix;
      if (t2.length <= MAX_TITLE_LENGTH) {
        title = t2;
      } else if (t2Core.length <= MAX_TITLE_LENGTH) {
        title = t2Core;
      } else {
        // Tier 3
        const t3Core = `${beach.name}: ${forecast.wave_height} Today`;
        const t3Suffix = buildTitleLocationSuffix(t3Core, beach.city, beach.state);
        title = truncateTitleForSEO(t3Suffix ? t3Core + t3Suffix : `${t3Core} | Surf Report`);
      }
    } else {
      // Tier 3: {Beach}: {height} Today + location suffix
      const t3Core = `${beach.name}: ${forecast.wave_height} Today`;
      const t3Suffix = buildTitleLocationSuffix(t3Core, beach.city, beach.state);
      title = truncateTitleForSEO(t3Suffix ? t3Core + t3Suffix : `${t3Core} | Surf Report`);
    }
  } else {
    // WITHOUT forecast: 3-tier fallback, each tier appends best-fitting location suffix

    // Tier 1 core: {Beach} — {Skill} {WaveChar} {BreakShort}
    if (skill && waveChar && beach.break_type) {
      const t1Core = `${beach.name} — ${skill} ${waveChar} ${shortBreakType(beach.break_type)}`;
      const t1Suffix = buildTitleLocationSuffix(t1Core, beach.city, beach.state);
      const t1 = t1Core + t1Suffix;
      if (t1.length <= MAX_TITLE_LENGTH) {
        title = t1;
      } else if (t1Core.length <= MAX_TITLE_LENGTH) {
        title = t1Core;
      } else if (skill && beach.break_type) {
        // Tier 2: {Beach} — {Skill} {Break}
        const t2Core = `${beach.name} — ${skill} ${capitalizeBreakType(beach.break_type)}`;
        const t2Suffix = buildTitleLocationSuffix(t2Core, beach.city, beach.state);
        const t2 = t2Core + t2Suffix;
        const t2Best = t2.length <= MAX_TITLE_LENGTH ? t2 : (t2Core.length <= MAX_TITLE_LENGTH ? t2Core : buildNoForecastTier3(beach.name, beach.break_type, crowdSignal, beach.city, beach.state));
        title = truncateTitleForSEO(t2Best);
      } else {
        title = truncateTitleForSEO(buildNoForecastTier3(beach.name, beach.break_type, crowdSignal, beach.city, beach.state));
      }
    } else if (skill && beach.break_type) {
      // Tier 2: {Beach} — {Skill} {Break} + location suffix
      const t2Core = `${beach.name} — ${skill} ${capitalizeBreakType(beach.break_type)}`;
      const t2Suffix = buildTitleLocationSuffix(t2Core, beach.city, beach.state);
      const t2 = t2Core + t2Suffix;
      if (t2.length <= MAX_TITLE_LENGTH) {
        title = t2;
      } else if (t2Core.length <= MAX_TITLE_LENGTH) {
        title = t2Core;
      } else {
        title = truncateTitleForSEO(buildNoForecastTier3(beach.name, beach.break_type, crowdSignal, beach.city, beach.state));
      }
    } else {
      // Tier 3
      title = truncateTitleForSEO(buildNoForecastTier3(beach.name, beach.break_type, crowdSignal, beach.city, beach.state));
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
    // WITH forecast description — location-aware opener
    const close = "7-day surf forecast, crowd intel & optimal windows.";
    const openerBase = `${forecast.wave_height} at ${beach.name}`;
    const openerLocation = locationContext ? `, ${locationContext}` : "";
    const opener = `${openerBase}${openerLocation}.`;

    // Budget accounting: description = opener + mid + " " + [ratingSignal + " "] + close
    // where mid = " {snippet}." = snippet.length + 2 chars
    const budgetWithRating = MAX_DESC - opener.length - 1 - close.length - (ratingSignal ? 1 + ratingSignal.length : 0) - 2;
    const budgetWithoutRating = MAX_DESC - opener.length - 1 - close.length - 2;
    const snippetBudget = Math.max(0, ratingSignal ? budgetWithRating : budgetWithoutRating);

    let mid = "";
    if (beach.wave_tips && snippetBudget > 10) {
      const snippet = extractDescriptionSnippet(beach.wave_tips, snippetBudget);
      mid = snippet ? ` ${snippet}.` : "";
    } else if (beach.break_type && beach.skill_level && snippetBudget > 10) {
      const candidate = ` ${capitalizeBreakType(beach.break_type)} for ${beach.skill_level} surfers.`;
      mid = candidate.length - 1 <= snippetBudget ? candidate : "";
    }

    const base = `${opener}${mid}`;
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
 * CTR Optimization (updated strategy):
 * - Titles emphasize Quiver's UNIQUE value (interactive chart, surf windows) over
 *   raw tide times that Google already surfaces in its knowledge panel.
 * - Users who see "High 5.2ft at 2:15 PM" in the SERP get their answer and don't click.
 *   Titles like "T-Street Tide Chart & Surf Windows | Mar 2026" highlight what only
 *   Quiver provides: surf-window analysis, 3-hour update cadence, 7-day outlook.
 * - Descriptions keep specific tide data to reinforce relevance and answer intent,
 *   but lead with the value proposition so the click driver is clear.
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

  // Title: emphasize unique value (chart + surf windows) over raw tide times.
  // Tier 1: "{Beach} Tide Chart & Surf Windows | {Mon YYYY}"
  // Tier 2 (name too long): "{Beach} Tide Chart & Surf Windows"
  // Tier 3 (still long): truncate beach name
  const coreTitle = `${beach.name} Tide Chart & Surf Windows`;
  const fullTitle = `${coreTitle} | ${monthYear}`;
  let title: string;
  if (fullTitle.length <= MAX_TITLE_LENGTH) {
    title = fullTitle;
  } else if (coreTitle.length <= MAX_TITLE_LENGTH) {
    title = coreTitle;
  } else {
    title = truncateTitleForSEO(`${beach.name} Tide Chart`);
  }

  // Description: lead with value proposition, then include live tide data for relevance.
  let description: string;
  if (tideData?.nextHighTime && tideData?.nextLowTime) {
    const highPart = tideData.nextHighHeight != null
      ? `High ${tideData.nextHighHeight}ft at ${tideData.nextHighTime}`
      : `High tide at ${tideData.nextHighTime}`;
    const lowPart = tideData.nextLowHeight != null
      ? `low ${tideData.nextLowHeight}ft at ${tideData.nextLowTime}`
      : `low at ${tideData.nextLowTime}`;
    const candidate = `Interactive tide chart with optimal surf windows for ${beach.name}. ${highPart}, ${lowPart}. Updated every 3 hours.`;
    description = candidate.length <= 160 ? candidate : candidate.slice(0, 157) + "…";
  } else {
    description = `Interactive tide chart with optimal surf windows for ${beach.name}. Updated every 3 hours with 7-day outlook and best-time-to-go analysis.`;
  }

  return { title, description };
}

/**
 * Build dynamic metadata for water temperature pages.
 * Falls back to generic titles when temperature data is unavailable.
 *
 * CTR Optimization (updated strategy):
 * - Titles emphasize Quiver's UNIQUE value (wetsuit guide, seasonal trends) over
 *   the raw temperature that Google already surfaces in knowledge panels.
 * - "Waikiki Beach Water Temperature: 78°F" → user sees temp and doesn't click.
 *   "Waikiki Beach Water Temp & Wetsuit Guide | Mar 2026" surfaces what only
 *   Quiver provides: wetsuit thickness recommendation, seasonal trend chart, buoy data.
 * - Descriptions remain specific (current temp + wetsuit rec) because they reinforce
 *   that our page has the data — but the click driver is the gear-planning angle.
 * - Month+Year date token keeps title fresh without encoding daily-volatile data.
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
  const now = new Date();
  const monthYear = now.toLocaleDateString("en-US", { month: "short", year: "numeric" });

  // Title: emphasize unique value (wetsuit guide) over raw temperature Google already shows.
  // Tier 1: "{Beach} Water Temp & Wetsuit Guide | {Mon YYYY}"
  // Tier 2 (name too long): "{Beach} Water Temp & Wetsuit Guide"
  // Tier 3 (still long): truncate beach name
  const coreTitle = `${beach.name} Water Temp & Wetsuit Guide`;
  const fullTitle = `${coreTitle} | ${monthYear}`;
  let title: string;
  if (fullTitle.length <= MAX_TITLE_LENGTH) {
    title = fullTitle;
  } else if (coreTitle.length <= MAX_TITLE_LENGTH) {
    title = coreTitle;
  } else {
    title = truncateTitleForSEO(`${beach.name} Water Temp`);
  }

  // Description: consistent value-first pattern regardless of whether we have live data.
  // The description reinforces what Quiver offers beyond the temperature number Google shows.
  // For very long beach names we drop the trailing sentence to stay within 160 chars.
  const MAX_DESC = 160;
  const fullDesc = `Current water temperature at ${beach.name} with wetsuit recommendations, seasonal trends, and real-time buoy data. Plan your session with the right gear.`;
  const shortDesc = `Current water temperature at ${beach.name} with wetsuit recommendations, seasonal trends, and real-time buoy data.`;
  let description: string;
  if (fullDesc.length <= MAX_DESC) {
    description = fullDesc;
  } else if (shortDesc.length <= MAX_DESC) {
    description = shortDesc;
  } else {
    // Last resort: hard truncate at word boundary
    const cut = fullDesc.slice(0, MAX_DESC - 1);
    const lastSpace = cut.lastIndexOf(" ");
    description = (lastSpace > MAX_DESC * 0.5 ? cut.slice(0, lastSpace) : cut) + "…";
  }

  return { title, description };
}
