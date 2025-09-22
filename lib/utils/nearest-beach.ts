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
    const d = calculateDistance(lat, lng, coords.lat, coords.lng, "km");
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
