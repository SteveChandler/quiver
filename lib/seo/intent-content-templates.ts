/**
 * Intent Content Templates
 *
 * Generates page content (title, heading, intro, meta description) for intent pages
 * using smart templates that inject real data from the database.
 */

import type { CityMetadata } from "@/actions/city/city-metadata-actions";
import type { SurfIntentSlug } from "@/lib/data/surf-spots";

export interface IntentPageContent {
  title: string;
  heading: string;
  intro: string;
  metaDescription: string;
}

interface ContentTemplateArgs {
  cityName: string;
  stateName: string;
  totalBeaches: number;
  beginnerCount: number;
  intermediateCount: number;
  advancedCount: number;
  topSpotNames: string;
  allSpotNames: string[];
}

/**
 * Build the page content for an intent page using smart templates.
 *
 * @param intent - The intent type (beginner, least-crowded, etc.)
 * @param metadata - City metadata from the database
 * @returns Content object with title, heading, intro, and metaDescription
 */
export function buildIntentPageContent(
  intent: SurfIntentSlug,
  metadata: CityMetadata
): IntentPageContent {
  const args: ContentTemplateArgs = {
    cityName: metadata.cityName,
    stateName: metadata.stateName,
    totalBeaches: metadata.totalBeaches,
    beginnerCount: metadata.beginnerCount,
    intermediateCount: metadata.intermediateCount,
    advancedCount: metadata.advancedCount,
    topSpotNames: metadata.beaches
      .slice(0, 3)
      .map((b) => b.name)
      .join(", "),
    allSpotNames: metadata.beaches.map((b) => b.name),
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
  const { cityName, stateName, totalBeaches, beginnerCount, topSpotNames } = args;
  // Note: advancedCount, intermediateCount, and allSpotNames are available for future template enhancements

  // Conditional intro text for cities with no beginner spots
  const beginnerIntro =
    beginnerCount > 0
      ? `${cityName} offers ${totalBeaches} surf spots along the ${stateName} coast, including beginner-friendly options at spots like ${topSpotNames}. Whether you're catching your first wave or building fundamentals, this guide helps you find the right break for your skill level.`
      : `${cityName} is known for more challenging waves suited to experienced surfers. While dedicated beginner spots are limited, the area offers ${totalBeaches} breaks including ${topSpotNames}. Consider visiting during smaller swells or checking nearby cities for more forgiving conditions.`;

  const leastCrowdedIntro = `Looking to escape the crowds? ${cityName} has ${totalBeaches} surf spots with varying levels of popularity. Spots like ${topSpotNames} offer quality waves with room to breathe, especially during off-peak hours and weekday sessions.`;

  const tideIntro = `Tide conditions significantly impact surfing in ${cityName}. With ${totalBeaches} breaks including ${topSpotNames}, each spot has optimal tide windows. This guide helps you time your sessions for the best conditions.`;

  const waterTempIntro = `Water temperatures in ${cityName}, ${stateName} vary throughout the year. Plan your sessions with our real-time water temp data for ${totalBeaches} local breaks including ${topSpotNames}. Know what wetsuit you need before you paddle out.`;

  const longboardIntro = `${cityName} offers excellent longboard waves at spots like ${topSpotNames}. With ${totalBeaches} breaks in the area, you'll find gentle, peeling waves perfect for nose riding and classic longboard surfing.`;

  const dawnPatrolIntro = `Early morning surf sessions in ${cityName} deliver glassy conditions and uncrowded lineups. ${totalBeaches} spots await, including ${topSpotNames}. Get the inside scoop on dawn patrol timing and conditions.`;

  const sunsetIntro = `Golden hour sessions in ${cityName} offer stunning views and often cleaner conditions as winds die down. Explore ${totalBeaches} breaks including ${topSpotNames} for your evening surf.`;

  return {
    beginner: {
      title: `${cityName} Beginner Surf Spots & Lessons | ${stateName}`,
      heading: `Beginner-friendly waves in ${cityName}`,
      intro: beginnerIntro,
      metaDescription: truncateMetaDescription(
        `Find beginner-friendly surf spots in ${cityName}, ${stateName}. ${totalBeaches} breaks including ${topSpotNames}. Updated daily.`
      ),
    },
    "least-crowded": {
      title: `Least Crowded Surf Spots in ${cityName} | ${stateName}`,
      heading: `Uncrowded surf spots in ${cityName}`,
      intro: leastCrowdedIntro,
      metaDescription: truncateMetaDescription(
        `Discover less crowded surf spots in ${cityName}. ${totalBeaches} breaks with insider tips on timing. Avoid the crowds at ${topSpotNames}.`
      ),
    },
    tide: {
      title: `${cityName} Tide Charts & Best Tides for Surfing | ${stateName}`,
      heading: `Tide conditions for ${cityName} surf spots`,
      intro: tideIntro,
      metaDescription: truncateMetaDescription(
        `Tide charts and optimal tide times for ${cityName} surf spots. ${totalBeaches} breaks including ${topSpotNames}. Updated in real-time.`
      ),
    },
    "water-temp": {
      title: `${cityName} Water Temperature & Wetsuit Guide | ${stateName}`,
      heading: `Water temperature in ${cityName}`,
      intro: waterTempIntro,
      metaDescription: truncateMetaDescription(
        `Current water temperatures in ${cityName}, ${stateName}. Wetsuit recommendations for ${totalBeaches} surf spots. Plan your session.`
      ),
    },
    longboard: {
      title: `${cityName} Longboard Spots & Conditions | ${stateName}`,
      heading: `Longboard-friendly waves in ${cityName}`,
      intro: longboardIntro,
      metaDescription: truncateMetaDescription(
        `Best longboard surf spots in ${cityName}. ${totalBeaches} breaks with mellow waves including ${topSpotNames}. Perfect for cruising.`
      ),
    },
    "dawn-patrol": {
      title: `${cityName} Dawn Patrol Surf Guide | Early Morning Sessions`,
      heading: `Dawn patrol surfing in ${cityName}`,
      intro: dawnPatrolIntro,
      metaDescription: truncateMetaDescription(
        `Dawn patrol surf guide for ${cityName}. Early morning conditions at ${totalBeaches} breaks including ${topSpotNames}. Beat the crowds.`
      ),
    },
    sunset: {
      title: `${cityName} Sunset Surf Sessions | Evening Conditions`,
      heading: `Sunset sessions in ${cityName}`,
      intro: sunsetIntro,
      metaDescription: truncateMetaDescription(
        `Sunset surf spots in ${cityName}. Golden hour sessions at ${totalBeaches} breaks including ${topSpotNames}. Evening conditions guide.`
      ),
    },
  };
}

/**
 * Truncate meta description to 160 characters max.
 * Tries to break at word boundary.
 */
function truncateMetaDescription(text: string): string {
  if (text.length <= 160) {
    return text;
  }

  // Find last space before 157 chars to allow for "..."
  const truncated = text.slice(0, 157);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > 100) {
    return truncated.slice(0, lastSpace) + "...";
  }

  return truncated + "...";
}
