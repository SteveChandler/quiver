// TODO: Migrate away from deprecated beach-coordinates.ts
// This file uses the legacy beachCoordinates dictionary for nearest-beach calculations.
// This should be migrated to database queries against the `beaches` table for accuracy
// and to include all active beaches. See deprecation notice in beach-coordinates.ts.
import { beachCoordinates } from "@/lib/constants/beach-coordinates";
import { calculateDistance } from "@/lib/utils/distance-utils";

function toTitleCase(name: string): string {
  return name
    .split(" ")
    .map((word) =>
      word.length === 0 ? word : word[0].toUpperCase() + word.slice(1)
    )
    .join(" ");
}

function getNearestBeach(
  lat: number,
  lng: number
): {
  key: string;
  name: string;
  distanceKm: number;
} {
  let nearestKey = "";
  let minDistanceKm = Number.POSITIVE_INFINITY;

  for (const key of Object.keys(beachCoordinates)) {
    const coords = beachCoordinates[key];
    const d = calculateDistance(
      { lat, lon: lng },
      { lat: coords.lat, lon: coords.lng },
      "km"
    );
    if (d < minDistanceKm) {
      minDistanceKm = d;
      nearestKey = key;
    }
  }

  const formatted = toTitleCase(nearestKey);
  return { key: nearestKey, name: formatted, distanceKm: minDistanceKm };
}

export function getNearestBeachName(lat: number, lng: number): string {
  return getNearestBeach(lat, lng).name;
}
