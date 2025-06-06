/**
 * Smart Beach Update Strategy Configuration
 *
 * This config maximizes forecast coverage while minimizing API calls by:
 * 1. Only updating "hub" beaches that provide unique geographic coverage
 * 2. Skipping beaches that consistently use nearby fallback data
 * 3. Focusing on high-value San Diego beaches surfers actually check
 */

export interface BeachUpdateStrategy {
  /** Beach name to match against database */
  name: string;
  /** Priority level (1 = highest, 3 = lowest) */
  priority: 1 | 2 | 3;
  /** Why this beach is important for updates */
  reason: string;
  /** Which other beaches benefit from this beach's data */
  provides_fallback_for?: string[];
}

/**
 * Beaches that should get fresh API data (max 9 to stay under quota)
 * These are "hub" beaches that provide unique coverage or serve as fallbacks
 */
export const BEACHES_TO_UPDATE: BeachUpdateStrategy[] = [
  {
    name: "Pacific Beach",
    priority: 1,
    reason:
      "Primary hub for San Diego central coast - provides fallback for 4+ beaches",
    provides_fallback_for: [
      "Ocean Beach",
      "Mission Beach",
      "Sunset Cliffs",
      "Crystal Pier",
    ],
  },
  {
    name: "La Jolla Shores",
    priority: 1,
    reason: "North San Diego coverage, popular beginner spot",
    provides_fallback_for: ["Tourmaline Surf Park"],
  },
  {
    name: "Windansea Beach",
    priority: 1,
    reason: "Iconic surf spot with different exposure than Pacific Beach",
  },
  {
    name: "Swami's Beach",
    priority: 2,
    reason: "Classic Encinitas break, north county coverage",
  },
  {
    name: "Encinitas (city center)",
    priority: 2,
    reason: "North county hub",
    provides_fallback_for: [
      "Leucadia State Beach",
      "Stone Steps",
      "Cardiff Reef",
    ],
  },
  {
    name: "Oceanside Pier",
    priority: 2,
    reason: "Northernmost San Diego coverage",
    provides_fallback_for: ["Oceanside Harbor Beach"],
  },
  {
    name: "Torrey Pines State Beach",
    priority: 2,
    reason: "Unique exposure between La Jolla and Del Mar",
  },
  {
    name: "Del Mar Beach",
    priority: 3,
    reason: "Central coast coverage between Encinitas and La Jolla",
  },
  {
    name: "Carlsbad State Beach",
    priority: 3,
    reason: "North county coverage",
    provides_fallback_for: ["Carlsbad Reef", "Carlsbad Point"],
  },
];

/**
 * Beaches that should NEVER get API updates because they consistently
 * use nearby fallback data. This saves precious API quota.
 */
export const BEACHES_TO_SKIP = [
  "Ocean Beach", // Always uses Pacific Beach
  "Mission Beach", // Always uses Pacific Beach
  "Sunset Cliffs", // Always uses Pacific Beach
  "Crystal Pier (Pacific Beach)", // Always uses Pacific Beach
  "Tourmaline Surf Park", // Uses La Jolla Shores
  "Leucadia State Beach", // Uses Encinitas
  "Stone Steps", // Uses Encinitas
  "Cardiff Reef", // Uses Encinitas
  "Oceanside Harbor Beach", // Uses Oceanside Pier
  "Carlsbad Reef (South Carlsbad)", // Uses Carlsbad State Beach
  "Carlsbad Point (North Carlsbad)", // Uses Carlsbad State Beach

  // Non-San Diego beaches (lower priority for daily updates)
  "Huntington Beach",
  "Trestles",
  "Malibu",
  "Pipeline",
  "Bells Beach",
  "Jeffreys Bay",
  "Uluwatu",
];

/**
 * Get beaches that should be updated today based on priority rotation
 * @param maxUpdates Maximum number of beaches to update (default 9 for free tier)
 * @returns Array of beach names to update
 */
export function getBeachesToUpdate(maxUpdates: number = 9): string[] {
  // Always include priority 1 beaches
  const priority1 = BEACHES_TO_UPDATE.filter((b) => b.priority === 1);

  // Add priority 2 beaches until we hit the limit
  const priority2 = BEACHES_TO_UPDATE.filter((b) => b.priority === 2);
  const priority3 = BEACHES_TO_UPDATE.filter((b) => b.priority === 3);

  const result: string[] = [];

  // Add all priority 1 (critical hubs)
  priority1.forEach((beach) => result.push(beach.name));

  // Add priority 2 until limit
  priority2.forEach((beach) => {
    if (result.length < maxUpdates) {
      result.push(beach.name);
    }
  });

  // Add priority 3 if there's room
  priority3.forEach((beach) => {
    if (result.length < maxUpdates) {
      result.push(beach.name);
    }
  });

  return result.slice(0, maxUpdates);
}

/**
 * Check if a beach should be skipped for API updates
 */
export function shouldSkipBeach(beachName: string): boolean {
  return BEACHES_TO_SKIP.some(
    (skipName) =>
      beachName.toLowerCase().includes(skipName.toLowerCase()) ||
      skipName.toLowerCase().includes(beachName.toLowerCase())
  );
}

/**
 * Get update strategy info for a beach
 */
export function getBeachStrategy(
  beachName: string
): BeachUpdateStrategy | null {
  return (
    BEACHES_TO_UPDATE.find(
      (strategy) =>
        beachName.toLowerCase().includes(strategy.name.toLowerCase()) ||
        strategy.name.toLowerCase().includes(beachName.toLowerCase())
    ) || null
  );
}
