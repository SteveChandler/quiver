/**
 * Beach Data Test Fixtures
 *
 * Mock beach data for testing beach transformation and mapping functionality.
 * Uses createMockBeachWithMetrics factory to ensure all required Beach fields are present.
 */

import type { BeachWithMetrics } from "@/types/location";
import { createMockBeachWithMetrics } from "../setup/typed-mocks";

/**
 * Complete beach with all fields populated
 */
export const mockBeachComplete: BeachWithMetrics = createMockBeachWithMetrics({
  id: "beach-complete-001",
  name: "Sunset Cliffs",
  slug: "sunset-cliffs",
  lat: 32.7198,
  lon: -117.2557,
  city: "San Diego",
  state: "CA",
  country: "USA",
  region: "San Diego County, California",
  description: "A scenic point break with consistent waves and rocky coastline.",
  skill_level: "Intermediate",
  crowd_level: "Moderate",
  best_months: [9, 10, 11],
  best_conditions_prose: "Works best on south swells with light offshore winds.",
  wave_tips: "Watch for rocks and rip currents near the point.",
  hazards: ["Rocks", "Strong currents", "Sea urchins"],
  features: ["Restrooms", "Parking", "Showers"],
  parking_tips: "Street parking available along Sunset Cliffs Blvd.",
  access_tips: "Multiple stairways down the cliffs.",
  break_type: "Point Break",
  compositeScore: 0.85,
  recentIntelCount: 12,
  avgConfirmations: 4.2,
  rank: 3,
  average_rating: 4.5,
  review_count: 87,
});

/**
 * Beginner-friendly beach
 */
export const mockBeachBeginner: BeachWithMetrics = createMockBeachWithMetrics({
  id: "beach-beginner-001",
  name: "La Jolla Shores",
  slug: "la-jolla-shores",
  lat: 32.8553,
  lon: -117.2563,
  city: "La Jolla",
  state: "CA",
  country: "USA",
  region: "San Diego County, California",
  description: "Wide sandy beach with gentle waves, perfect for beginners.",
  skill_level: "Beginner",
  crowd_level: "Heavy",
  best_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  best_conditions_prose: "Best in summer with small south swells.",
  wave_tips: "Soft sand bottom makes wipeouts forgiving.",
  hazards: ["Stingrays"],
  features: ["Restrooms", "Parking", "Lifeguards", "Rentals"],
  parking_tips: "Large parking lot with meters.",
  access_tips: "Beach level access from parking lot.",
  break_type: "Beach Break",
  compositeScore: 0.92,
  recentIntelCount: 25,
  avgConfirmations: 5.1,
  rank: 1,
  average_rating: 4.8,
  review_count: 234,
});

/**
 * Longboard-friendly beach
 */
export const mockBeachLongboard: BeachWithMetrics = createMockBeachWithMetrics({
  id: "beach-longboard-001",
  name: "Tourmaline",
  slug: "tourmaline",
  lat: 32.8048,
  lon: -117.2657,
  city: "Pacific Beach",
  state: "CA",
  country: "USA",
  region: "San Diego County, California",
  description: "Mellow point break ideal for longboarders.",
  skill_level: "Longboard",
  crowd_level: "Light",
  best_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  best_conditions_prose: "Any south or west swell works here.",
  wave_tips: "Long rides possible on bigger days.",
  hazards: [],
  features: ["Parking", "Restrooms"],
  parking_tips: "Free lot fills up early on weekends.",
  access_tips: "Easy beach access from parking lot.",
  break_type: "Point Break",
  compositeScore: 0.78,
  recentIntelCount: 8,
  avgConfirmations: 3.5,
  rank: 5,
  average_rating: 4.3,
  review_count: 56,
});

/**
 * Advanced beach
 */
export const mockBeachAdvanced: BeachWithMetrics = createMockBeachWithMetrics({
  id: "beach-advanced-001",
  name: "Blacks Beach",
  slug: "blacks-beach",
  lat: 32.8891,
  lon: -117.2529,
  city: "San Diego",
  state: "CA",
  country: "USA",
  region: "San Diego County, California",
  description: "World-class beach break with powerful waves.",
  skill_level: "Advanced",
  crowd_level: "Moderate",
  best_months: [10, 11, 12, 1, 2, 3],
  best_conditions_prose: "Best on large west swells with offshore Santa Anas.",
  wave_tips: "Powerful waves with steep takeoffs.",
  hazards: ["Strong currents", "Difficult access"],
  features: [],
  parking_tips: "Park at Gliderport and hike down.",
  access_tips: "Long hike down steep cliff.",
  break_type: "Beach Break",
  compositeScore: 0.88,
  recentIntelCount: 15,
  avgConfirmations: 4.8,
  rank: 2,
  average_rating: 4.7,
  review_count: 156,
});

/**
 * Expert-only beach
 */
export const mockBeachExpert: BeachWithMetrics = createMockBeachWithMetrics({
  id: "beach-expert-001",
  name: "Windansea",
  slug: "windansea",
  lat: 32.8333,
  lon: -117.2831,
  city: "La Jolla",
  state: "CA",
  country: "USA",
  region: "San Diego County, California",
  description: "Challenging reef break for experienced surfers.",
  skill_level: "Expert",
  crowd_level: "Heavy",
  best_months: [11, 12, 1, 2],
  best_conditions_prose: "Needs large west swell and calm winds.",
  wave_tips: "Shallow reef, aggressive locals.",
  hazards: ["Shallow reef", "Rocks", "Localism"],
  features: [],
  parking_tips: "Limited street parking.",
  access_tips: "Stairs down to beach.",
  break_type: "Reef Break",
  compositeScore: 0.75,
  recentIntelCount: 10,
  avgConfirmations: 4.0,
  rank: 6,
  average_rating: 4.2,
  review_count: 89,
});

/**
 * Beach with minimal data (edge case testing)
 */
export const mockBeachMinimal: BeachWithMetrics = createMockBeachWithMetrics({
  id: "beach-minimal-001",
  name: "Unknown Beach",
  slug: "unknown-beach",
  lat: 0,
  lon: 0,
  compositeScore: 0,
  recentIntelCount: 0,
  avgConfirmations: 0,
  rank: undefined,
  average_rating: 0,
  review_count: 0,
});

/**
 * Beach with invalid coordinates (out of bounds)
 */
export const mockBeachInvalidCoords: BeachWithMetrics = createMockBeachWithMetrics({
  ...mockBeachComplete,
  id: "beach-invalid-coords-001",
  name: "Invalid Coords Beach",
  slug: "invalid-coords-beach",
  lat: 200, // Invalid: > 90
  lon: -400, // Invalid: < -180
});

/**
 * Beach in Orange County
 */
export const mockBeachOrangeCounty: BeachWithMetrics = createMockBeachWithMetrics({
  id: "beach-oc-001",
  name: "Huntington Beach",
  slug: "huntington-beach",
  lat: 33.6595,
  lon: -118.0015,
  city: "Orange County",
  state: "CA",
  country: "USA",
  region: "Orange County, California",
  description: "Surf City USA with consistent beach break.",
  skill_level: "Intermediate",
  crowd_level: "Heavy",
  best_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  best_conditions_prose: "Works on most swells.",
  wave_tips: "Watch for crowds near the pier.",
  hazards: ["Crowds"],
  features: ["Restrooms", "Parking", "Lifeguards"],
  parking_tips: "Large public lots available.",
  access_tips: "Easy beach access.",
  break_type: "Beach Break",
  compositeScore: 0.82,
  recentIntelCount: 20,
  avgConfirmations: 4.0,
  rank: 4,
  average_rating: 4.4,
  review_count: 312,
});

/**
 * Beach with light crowd
 */
export const mockBeachLightCrowd: BeachWithMetrics = createMockBeachWithMetrics({
  ...mockBeachLongboard,
  id: "beach-light-crowd-001",
  name: "Secret Spot",
  slug: "secret-spot",
  crowd_level: "Low",
});

/**
 * Collection of all mock beaches for batch testing
 */
export const mockBeachCollection: BeachWithMetrics[] = [
  mockBeachComplete,
  mockBeachBeginner,
  mockBeachLongboard,
  mockBeachAdvanced,
  mockBeachExpert,
  mockBeachOrangeCounty,
];

/**
 * Empty beach collection
 */
export const mockBeachCollectionEmpty: BeachWithMetrics[] = [];
