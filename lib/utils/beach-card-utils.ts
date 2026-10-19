import type { Beach } from "@/types/database";

/**
 * Get beach location display string from city, state, and region
 * Prioritizes city/state, falls back to region or "California"
 */
export function getBeachLocation(beach: Beach): string {
  if (beach.city && beach.state) {
    return `${beach.city}, ${beach.state}`;
  }
  if (beach.city) {
    return beach.city;
  }
  if (beach.state) {
    return beach.state;
  }
  if (beach.region) {
    return beach.region;
  }
  return "California";
}
