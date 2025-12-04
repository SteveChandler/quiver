/**
 * Beach to SurfSpot Transformer
 *
 * Transforms BeachWithMetrics (from Supabase database) to SurfSpot format
 * for compatibility with CityMapView component.
 *
 * CRITICAL COORDINATE MAPPING:
 * - Database uses: lat, lon
 * - SurfSpot uses: coordinates.lat, coordinates.lng
 * - This transformer explicitly maps lon → lng
 */

import type { BeachWithMetrics } from "@/types/location";
import type { SurfSpot, SurfCitySlug, SurfIntentSlug } from "@/lib/data/surf-spots";

/**
 * Map database skill_level to SurfSpot skillLevel enum
 */
function mapSkillLevel(
  dbSkillLevel: string | null
): SurfSpot["skillLevel"] {
  if (!dbSkillLevel) return "Intermediate";

  const normalized = dbSkillLevel.toLowerCase();

  if (normalized.includes("beginner")) return "Beginner friendly";
  if (normalized.includes("longboard")) return "Longboard friendly";
  if (normalized.includes("advanced")) return "Advanced";
  if (normalized.includes("expert")) return "Intermediate to expert";

  return "Intermediate";
}

/**
 * Map database crowd_level to SurfSpot crowdFactor enum
 */
function mapCrowdFactor(
  dbCrowdLevel: string | null
): SurfSpot["crowdFactor"] {
  if (!dbCrowdLevel) return "Moderate";

  const normalized = dbCrowdLevel.toLowerCase();

  if (normalized.includes("light") || normalized.includes("low")) return "Light";
  if (normalized.includes("heavy") || normalized.includes("high")) return "Heavy";

  return "Moderate";
}

/**
 * Derive city slug from city name
 */
function deriveCitySlug(cityName: string | null): SurfCitySlug {
  if (!cityName) return "san-diego";

  const normalized = cityName.toLowerCase();

  if (normalized.includes("orange")) return "orange-county";

  // San Diego metro area cities
  if (
    normalized.includes("san diego") ||
    normalized.includes("la jolla") ||
    normalized.includes("pacific beach") ||
    normalized.includes("ocean beach") ||
    normalized.includes("coronado") ||
    normalized.includes("encinitas") ||
    normalized.includes("carlsbad") ||
    normalized.includes("del mar")
  ) {
    return "san-diego";
  }

  return "san-diego"; // Default
}

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
  // CRITICAL: Map lon → lng for coordinate naming convention
  const lat = beach.lat ?? 32.7157; // San Diego default
  const lon = beach.lon ?? -117.1611;

  return {
    id: beach.id, // Preserve database UUID for forecast lookups
    slug: beach.slug,
    name: beach.name,
    citySlug: deriveCitySlug(beach.city),
    region: beach.region ?? `${beach.city ?? "Unknown"}, ${beach.state ?? "CA"}`,

    // COORDINATE MAPPING: lon (database) → lng (SurfSpot)
    coordinates: {
      lat: lat,
      lng: lon, // Explicit lon → lng mapping
    },

    // Content fields
    overview: beach.description ?? "No description available.",
    history: "", // Not available in database
    conditions: beach.best_conditions_prose ?? "",
    tideAdvice: "", // Not available in database
    swellAdvice: beach.wave_tips ?? "",
    windAdvice: "", // Not available in database
    waterTemp: "", // Not available in database

    // Safety and skill
    hazards: beach.hazards ?? [],
    skillLevel: mapSkillLevel(beach.skill_level),
    bestSeason: beach.best_months ?? "",
    crowdFactor: mapCrowdFactor(beach.crowd_level),

    // Access info
    parking: beach.parking_tips ?? beach.access_tips ?? "",
    amenities: beach.features ?? [],
    nearby: [], // Would require separate query

    // FAQ and voice
    faq: [],
    speakableSummary:
      beach.description ?? `${beach.name} is a surf spot in ${beach.city ?? "California"}.`,

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
