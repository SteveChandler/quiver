/**
 * Transforms Beach database rows to SpotPageData format for the spots pages.
 * Bridges the gap between the database schema and the spot page requirements.
 */

import type { Beach } from "@/types/database";
import type { SurfSpot } from "@/lib/data/surf-spots";
import { inferCitySlug } from "@/lib/utils/beach-mapping-helpers";

/**
 * Unified data structure for spot pages.
 * Can be populated from either database or static data.
 */
export interface SpotPageData {
  // Core identifiers
  id: string | null;
  slug: string;
  name: string;

  // Location
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  state: string | null;
  region: string | null;
  /** City slug for intent page links (e.g., "huntington-beach", "san-diego") */
  citySlug: string | null;

  // Content (from database)
  description: string | null;
  breakType: string | null;
  skillLevel: string | null;
  hazards: string[] | null;
  features: string[] | null;
  parkingTips: string | null;
  bestConditions: string | null;

  // Extended content (from static data, if available)
  overview: string | null;
  history: string | null;
  conditions: string | null;
  tideAdvice: string | null;
  swellAdvice: string | null;
  windAdvice: string | null;
  waterTemp: string | null;
  bestSeason: string | null;
  crowdFactor: "Light" | "Moderate" | "Heavy" | null;
  parking: string | null;
  amenities: string[] | null;
  nearby: string[] | null;
  faq: { question: string; answer: string }[] | null;
  speakableSummary: string | null;
  beginnerNotes: string | null;
  intentTags: string[] | null;
}

/**
 * Transforms a Beach database row to SpotPageData format.
 * Used when fetching spot data from the database.
 */
export function transformBeachToSpotData(beach: Beach): SpotPageData {
  const citySlug = inferCitySlug(beach.city || null);
  const region = [beach.city, beach.state].filter(Boolean).join(", ");

  return {
    // Core identifiers
    id: beach.id,
    slug: beach.slug || "",
    name: beach.name,

    // Location - using database naming convention (lat/lon)
    latitude: beach.lat ?? null,
    longitude: beach.lon ?? null,
    city: beach.city || null,
    state: beach.state || null,
    region: region || null,
    citySlug,

    // Content from database
    description: beach.description || null,
    breakType: beach.break_type || null,
    skillLevel: beach.skill_level || null,
    hazards: beach.hazards || null,
    features: beach.features || null,
    parkingTips: beach.parking_tips || null,
    bestConditions: beach.best_conditions_prose || null,

    // Extended content - not available from database, will be null
    overview: beach.description || null, // Use description as fallback
    history: null,
    conditions: beach.best_conditions_prose || null,
    tideAdvice: null,
    swellAdvice: null,
    windAdvice: null,
    waterTemp: null,
    bestSeason: null,
    crowdFactor: null,
    parking: beach.parking_tips || null,
    amenities: beach.features || null,
    nearby: null,
    faq: null,
    speakableSummary: null,
    beginnerNotes: null,
    intentTags: null,
  };
}

/**
 * Transforms a static SurfSpot to SpotPageData format.
 * Used as fallback when database lookup fails.
 */
export function transformStaticSpotToSpotData(spot: SurfSpot): SpotPageData {
  return {
    // Core identifiers
    id: spot.id || null,
    slug: spot.slug,
    name: spot.name,

    // Location - static data uses 'lon', same convention as database
    latitude: spot.coordinates.lat,
    longitude: spot.coordinates.lon,
    city: null,
    state: null,
    region: spot.region,
    citySlug: spot.citySlug,

    // Content
    description: spot.overview,
    breakType: null,
    skillLevel: spot.skillLevel,
    hazards: spot.hazards,
    features: spot.amenities,
    parkingTips: spot.parking,
    bestConditions: null,

    // Extended content from static data
    overview: spot.overview,
    history: spot.history,
    conditions: spot.conditions,
    tideAdvice: spot.tideAdvice,
    swellAdvice: spot.swellAdvice,
    windAdvice: spot.windAdvice,
    waterTemp: spot.waterTemp,
    bestSeason: spot.bestSeason,
    crowdFactor: spot.crowdFactor,
    parking: spot.parking,
    amenities: spot.amenities,
    nearby: spot.nearby,
    faq: spot.faq,
    speakableSummary: spot.speakableSummary,
    beginnerNotes: spot.beginnerNotes || null,
    intentTags: spot.intentTags,
  };
}

/**
 * Merges database data with static data to get the best of both.
 * Database provides: id, coordinates, basic info
 * Static provides: rich content (history, advice, FAQs, etc.)
 */
export function mergeSpotData(
  dbData: SpotPageData | null,
  staticData: SpotPageData | null
): SpotPageData | null {
  if (!dbData && !staticData) return null;
  if (!dbData) return staticData;
  if (!staticData) return dbData;

  // Merge: prefer database for IDs and coordinates, static for content
  return {
    // Core identifiers - prefer database
    id: dbData.id || staticData.id,
    slug: dbData.slug || staticData.slug,
    name: dbData.name || staticData.name,

    // Location - prefer database (has real coordinates)
    latitude: dbData.latitude ?? staticData.latitude,
    longitude: dbData.longitude ?? staticData.longitude,
    city: dbData.city || staticData.city,
    state: dbData.state || staticData.state,
    region: dbData.region || staticData.region,
    citySlug: dbData.citySlug || staticData.citySlug,

    // Content - prefer static (richer content)
    description: staticData.description || dbData.description,
    breakType: dbData.breakType || staticData.breakType,
    skillLevel: staticData.skillLevel || dbData.skillLevel,
    hazards: staticData.hazards || dbData.hazards,
    features: staticData.features || dbData.features,
    parkingTips: staticData.parkingTips || dbData.parkingTips,
    bestConditions: dbData.bestConditions ?? staticData.bestConditions,

    // Extended content - prefer static
    overview: staticData.overview || dbData.overview,
    history: staticData.history || dbData.history,
    conditions: staticData.conditions || dbData.conditions,
    tideAdvice: staticData.tideAdvice || dbData.tideAdvice,
    swellAdvice: staticData.swellAdvice || dbData.swellAdvice,
    windAdvice: staticData.windAdvice || dbData.windAdvice,
    waterTemp: staticData.waterTemp || dbData.waterTemp,
    bestSeason: staticData.bestSeason || dbData.bestSeason,
    crowdFactor: staticData.crowdFactor || dbData.crowdFactor,
    parking: staticData.parking || dbData.parking,
    amenities: staticData.amenities || dbData.amenities,
    nearby: staticData.nearby || dbData.nearby,
    faq: staticData.faq || dbData.faq,
    speakableSummary: staticData.speakableSummary || dbData.speakableSummary,
    beginnerNotes: staticData.beginnerNotes || dbData.beginnerNotes,
    intentTags: staticData.intentTags || dbData.intentTags,
  };
}
