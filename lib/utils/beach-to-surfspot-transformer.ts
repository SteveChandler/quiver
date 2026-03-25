/**
 * Beach to SurfSpot Transformer
 *
 * Transforms BeachWithMetrics (from Supabase database) to SurfSpot format
 * for compatibility with CityMapView component.
 *
 * CRITICAL COORDINATE MAPPING:
 * - Database uses: lat, lon
 * - SurfSpot uses: coordinates.lat, coordinates.lon
 * - Both use the same naming convention (no mapping needed)
 */

import type { BeachWithMetrics } from "@/types/location";
import type { SurfSpot, SurfIntentSlug } from "@/lib/data/surf-spots";
import { sanitizeBeachDescription } from "@/lib/utils/text-utils";
import {
  mapSkillLevel,
  mapCrowdFactor,
  inferCitySlugForSurfSpot,
} from "@/lib/utils/beach-mapping-helpers";

/**
 * Transform a BeachWithMetrics object to SurfSpot format.
 *
 * This enables using database beaches with CityMapView component
 * which expects the SurfSpot interface.
 *
 * @param beach - Beach object from database with metrics
 * @returns SurfSpot-compatible object for CityMapView
 */
export function transformBeachToSurfSpot(beach: BeachWithMetrics): SurfSpot {
  // Map database coordinates to SurfSpot format
  const fallbackSlug = beach.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const bestSeason = Array.isArray(beach.best_months)
    ? beach.best_months.join(", ")
    : "";

  return {
    id: beach.id, // Preserve database UUID for forecast lookups
    slug: beach.slug ?? fallbackSlug,
    name: beach.name,
    citySlug: inferCitySlugForSurfSpot(beach.city),
    city: beach.city ?? undefined,
    region: beach.region ?? `${beach.city ?? "Unknown"}, ${beach.state ?? "CA"}`,

    // Coordinates: database and SurfSpot both use lat/lon
    coordinates: {
      lat: beach.lat,
      lon: beach.lon,
    },

    // Content fields - sanitize description to strip leading **BeachName** markers
    overview: sanitizeBeachDescription(beach.description, beach.name) ?? "No description available.",
    history: "", // Not available in database
    conditions: beach.best_conditions_prose ?? "",
    tideAdvice: "", // Not available in database
    swellAdvice: beach.wave_tips ?? "",
    windAdvice: "", // Not available in database
    waterTemp: "", // Not available in database

    // Safety and skill
    hazards: beach.hazards ?? [],
    skillLevel: mapSkillLevel(beach.skill_level),
    bestSeason,
    crowdFactor: mapCrowdFactor(beach.crowd_level),

    // Access info
    parking: beach.parking_tips ?? beach.access_tips ?? "",
    amenities: beach.features ?? [],
    nearby: [], // Would require separate query

    // FAQ and voice - sanitize description to strip leading **BeachName** markers
    faq: [],
    speakableSummary:
      sanitizeBeachDescription(beach.description, beach.name) ??
      `${beach.name} is a surf spot in ${beach.city ?? "California"}.`,

    // Optional fields
    beginnerNotes: beach.skill_level?.toLowerCase().includes("beginner")
      ? "This spot is suitable for beginners."
      : undefined,

    // Intent tags - derive from skill level
    intentTags: deriveIntentTags(beach),
  };
}

/**
 * Derive intent tags from beach properties
 */
function deriveIntentTags(beach: BeachWithMetrics): SurfIntentSlug[] {
  const tags: SurfIntentSlug[] = [];

  const skillLevel = (beach.skill_level ?? "").toLowerCase();
  const crowdLevel = (beach.crowd_level ?? "").toLowerCase();

  // Beginner intent
  if (skillLevel.includes("beginner") || skillLevel.includes("longboard")) {
    tags.push("beginner");
  }

  // Less crowded intent
  if (crowdLevel.includes("light") || crowdLevel.includes("low")) {
    tags.push("least-crowded");
  }

  // All spots are relevant to tide timing
  tags.push("tide");

  // Water temp is generally applicable
  tags.push("water-temp");

  return tags;
}

/**
 * Transform an array of BeachWithMetrics to SurfSpot format.
 *
 * @param beaches - Array of beaches from database
 * @returns Array of SurfSpot-compatible objects
 */
export function transformBeachesToSurfSpots(
  beaches: BeachWithMetrics[]
): SurfSpot[] {
  return beaches.map(transformBeachToSurfSpot);
}

/**
 * Validate coordinates before transformation.
 * Logs a warning in development if coordinates are missing or invalid.
 */
export function validateBeachCoordinates(
  beach: BeachWithMetrics,
  context: string = "transformer"
): boolean {
  const isValid =
    beach.lat !== null &&
    beach.lon !== null &&
    !isNaN(beach.lat) &&
    !isNaN(beach.lon) &&
    beach.lat >= -90 &&
    beach.lat <= 90 &&
    beach.lon >= -180 &&
    beach.lon <= 180;

  if (!isValid && process.env.NODE_ENV === "development") {
    console.warn(
      `[${context}] Invalid coordinates for beach "${beach.name}": lat=${beach.lat}, lon=${beach.lon}`
    );
  }

  return isValid;
}
