/**
 * Intent Content Templates
 *
 * Generates page content (title, heading, intro, meta description) for intent pages
 * using smart templates that inject real data from the database.
 */

import type { CityMetadata } from "@/types/location";
import type { SurfIntentSlug } from "@/lib/data/surf-spots";
import { getClimateZone } from "@/lib/seo/regional-surf-data";
import { truncateTitleForSEO } from "@/lib/seo/meta";
import { truncateMetaDescription } from "@/lib/utils/seo-utils";

export interface IntentPageContent {
  title: string;
  heading: string;
  intro: string;
  metaDescription: string;
}

interface ContentTemplateArgs {
  cityName: string;
  stateName: string;
  stateSlug: string;
  totalBeaches: number;
  beginnerCount: number;
  intermediateCount: number;
  advancedCount: number;
  topSpotNames: string;
  allSpotNames: string[];
  tideData?: { nextTideType?: string | null; nextTideTime?: string | null; nextTideHeight?: string | null } | null;
  waterTempData?: { currentTemp?: number | null } | null;
}

/**
 * Build the page content for an intent page using smart templates.
 *
 * @param intent - The intent type (beginner, least-crowded, etc.)
 * @param metadata - City metadata from the database
 * @param dynamicData - Optional dynamic data (e.g., tide data)
 * @returns Content object with title, heading, intro, and metaDescription
 */
export function buildIntentPageContent(
  intent: SurfIntentSlug,
  metadata: CityMetadata,
  dynamicData?: {
    tideData?: { nextTideType?: string | null; nextTideTime?: string | null; nextTideHeight?: string | null } | null;
    waterTempData?: { currentTemp?: number | null } | null;
  }
): IntentPageContent {
  const args: ContentTemplateArgs = {
    cityName: metadata.cityName,
    stateName: metadata.stateName,
    stateSlug: metadata.state.toLowerCase(),
    totalBeaches: metadata.totalBeaches,
    beginnerCount: metadata.beginnerCount,
    intermediateCount: metadata.intermediateCount,
    advancedCount: metadata.advancedCount,
    topSpotNames: metadata.beaches
      .slice(0, 3)
      .map((b) => b.name)
      .join(", "),
    allSpotNames: metadata.beaches.map((b) => b.name),
    tideData: dynamicData?.tideData ?? null,
    waterTempData: dynamicData?.waterTempData ?? null,
  };

  const templates = getIntentTemplates(args);
  return templates[intent];
}

/**
 * Get content templates for all intents using the provided args.
 */
function getIntentTemplates(
  args: ContentTemplateArgs
): Record<SurfIntentSlug, IntentPageContent> {
  const { cityName, stateName, stateSlug, totalBeaches, beginnerCount, topSpotNames, tideData, waterTempData } = args;
  // Note: advancedCount, intermediateCount, and allSpotNames are available for future template enhancements

  // Conditional intro text for cities with no beginner spots
  const beginnerIntro =
    beginnerCount > 0
      ? `${cityName} has ${totalBeaches} breaks along the ${stateName} coast. ${beginnerCount} of those have gentle enough sandbars and small enough crowds for learning. Start at ${topSpotNames} and work your way up as you get comfortable reading the lineup.`
      : `${cityName} is known for more challenging waves suited to experienced surfers. While dedicated beginner spots are limited, the area offers ${totalBeaches} breaks including ${topSpotNames}. Consider visiting during smaller swells or checking nearby cities for more forgiving conditions.`;

  const leastCrowdedIntro = `When ${cityName} lineups stack up, knowing a backup changes everything. These ${totalBeaches} breaks range from tucked-away reef passes to underrated sandbars that stay empty even on weekend south pulses.`;

  const tideIntro = `A foot of tide swing can shut down one break and light up another in ${cityName}. These ${totalBeaches} spots all respond differently - some need the low to expose the bar, others clean up on a rising mid.`;

  const waterTempIntro = (() => {
    const zone = getClimateZone(stateSlug);
    switch (zone) {
      case "tropical":
        return `${cityName} stays warm year-round with water temps rarely dipping below the mid-70s. A rashguard handles most sessions, and reef booties are more important than neoprene here. Use this guide to plan around trade wind shifts and seasonal swell patterns.`;
      case "warm-atlantic":
        return `${cityName} water stays swimmable most of the year, but winter cold fronts can drop temps fast. Hurricane season brings the warmest water alongside the best waves. This guide helps you pick the right rubber for each season.`;
      case "cold-pacific":
        return `${cityName} water runs cold year-round - you'll want a thick wetsuit even in summer. The upside: powerful swells, uncrowded lineups, and dramatic coastline. Use this guide to stay warm and surf longer.`;
      case "temperate-pacific":
        return `Pack the right rubber and you'll extend your sessions in ${cityName} by an hour. Temps swing from upwelling lows to summer peaks, and the difference between a 3/2 and a 4/3 day can come overnight.`;
      case "cold-atlantic":
        return `${cityName} water temps swing dramatically with the seasons - from frigid winter surf requiring full hooded suits to warm summer sessions in trunks or a spring suit. This guide helps you gear up right for every month.`;
    }
  })();

  const longboardIntro = `${cityName} delivers the kind of mellow walls that make nine-footers purr. These ${totalBeaches} breaks offer long shoulders, patient sections, and enough face to cross-step without rushing.`;

  const dawnPatrolIntro = `First light in ${cityName} means glass, empty peaks, and the best conditions of the day before thermal onshores build. These ${totalBeaches} spots are worth the 5am alarm.`;

  const sunsetIntro = `After-work glass-offs in ${cityName} can rival dawn patrol on good days. Afternoon thermals die, the crowd thins, and these ${totalBeaches} west-facing breaks catch the last clean sets of the day.`;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().toLocaleDateString("en-US", { month: "long" });
  const spotCount = beginnerCount > 0 ? beginnerCount : totalBeaches;
  const DATA_FRESHNESS_SUFFIX = "Updated hourly with live buoy data.";
  const spotNoun = (n: number) => n === 1 ? "spot" : "spots";
  const breakNoun = (n: number) => n === 1 ? "break" : "breaks";

  return {
    beginner: {
      title: truncateTitleForSEO(
        `${spotCount} Best Beginner Surf Spots in ${cityName} (${currentYear})`
      ),
      heading: `Beginner-friendly waves in ${cityName}`,
      intro: beginnerIntro,
      metaDescription: truncateMetaDescription(
        `${spotCount} beginner-friendly surf ${spotNoun(spotCount)} in ${cityName}, ${stateName}. Skill ratings, wave size & crowd levels at ${topSpotNames}. ${DATA_FRESHNESS_SUFFIX}`
      ),
    },
    "least-crowded": {
      title: truncateTitleForSEO(
        `${totalBeaches} Least Crowded Surf Spots in ${cityName} (${currentYear})`
      ),
      heading: `Least crowded surf spots in ${cityName}`,
      intro: leastCrowdedIntro,
      metaDescription: truncateMetaDescription(
        `${totalBeaches} uncrowded surf ${spotNoun(totalBeaches)} in ${cityName}, ${stateName} ranked by real crowd data. Best times to paddle out at ${topSpotNames}. ${DATA_FRESHNESS_SUFFIX}`
      ),
    },
    tide: {
      title: truncateTitleForSEO(
        tideData?.nextTideType && tideData?.nextTideTime
          ? `${cityName} Tide Chart Today: Next ${tideData.nextTideType} ${tideData.nextTideTime}`
          : `${cityName} Tide Charts Today | ${totalBeaches} Surf Spots`
      ),
      heading: `Tide conditions for ${cityName} surf spots`,
      intro: tideIntro,
      metaDescription: truncateMetaDescription(
        tideData?.nextTideType && tideData?.nextTideTime && tideData?.nextTideHeight
          ? `${cityName}, ${stateName} tides today: Next ${tideData.nextTideType} ${tideData.nextTideTime} (${tideData.nextTideHeight}). Charts for ${totalBeaches} ${breakNoun(totalBeaches)} including ${topSpotNames}. ${DATA_FRESHNESS_SUFFIX}`
          : `${cityName}, ${stateName} tide charts today. High and low times for ${totalBeaches} surf ${spotNoun(totalBeaches)} including ${topSpotNames}. ${DATA_FRESHNESS_SUFFIX}`
      ),
    },
    "water-temp": {
      title: truncateTitleForSEO(
        waterTempData?.currentTemp
          ? `${cityName} Water Temp: ${waterTempData.currentTemp}°F Today | Wetsuit Guide for ${currentMonth}`
          : `${cityName} Water Temp Today | Wetsuit Guide (${currentYear})`
      ),
      heading: `Water temperature in ${cityName}`,
      intro: waterTempIntro,
      metaDescription: truncateMetaDescription(
        waterTempData?.currentTemp
          ? `${cityName} water is ${waterTempData.currentTemp}°F today. Wetsuit guide & seasonal temps for ${totalBeaches} surf ${spotNoun(totalBeaches)} including ${topSpotNames}. ${DATA_FRESHNESS_SUFFIX}`
          : `Current water temperatures in ${cityName}, ${stateName}. Wetsuit guide & seasonal trends for ${totalBeaches} surf ${spotNoun(totalBeaches)} including ${topSpotNames}. ${DATA_FRESHNESS_SUFFIX}`
      ),
    },
    longboard: {
      title: truncateTitleForSEO(
        `${totalBeaches} Longboard Waves in ${cityName} | Mellow Points & Beach Breaks`
      ),
      heading: `Longboard-friendly waves in ${cityName}`,
      intro: longboardIntro,
      metaDescription: truncateMetaDescription(
        `${totalBeaches} longboard-friendly ${spotNoun(totalBeaches)} in ${cityName}, ${stateName} with mellow waves and long shoulders at ${topSpotNames}. ${DATA_FRESHNESS_SUFFIX}`
      ),
    },
    "dawn-patrol": {
      title: truncateTitleForSEO(
        `Best Time to Surf ${cityName}: ${totalBeaches} Dawn Patrol Spots`
      ),
      heading: `Dawn patrol surfing in ${cityName}`,
      intro: dawnPatrolIntro,
      metaDescription: truncateMetaDescription(
        `Best time to surf ${cityName}, ${stateName} today — dawn patrol conditions and wind forecasts at ${totalBeaches} ${breakNoun(totalBeaches)} including ${topSpotNames}. ${DATA_FRESHNESS_SUFFIX}`
      ),
    },
    sunset: {
      title: truncateTitleForSEO(
        `Sunset Surf ${cityName}: Golden Hour at ${totalBeaches} Spots`
      ),
      heading: `Sunset sessions in ${cityName}`,
      intro: sunsetIntro,
      metaDescription: truncateMetaDescription(
        `Sunset surf sessions in ${cityName}, ${stateName}: golden hour conditions at ${totalBeaches} ${spotNoun(totalBeaches)} including ${topSpotNames} as winds die. ${DATA_FRESHNESS_SUFFIX}`
      ),
    },
  };
}
