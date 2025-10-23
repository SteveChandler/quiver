/**
 * Utility functions for beach conditions analysis
 */

// Helper function to convert wind direction text to degrees
export function getWindDirectionDegrees(direction: string): number {
  const map: Record<string, number> = {
    N: 0,
    NNE: 22.5,
    NE: 45,
    ENE: 67.5,
    E: 90,
    ESE: 112.5,
    SE: 135,
    SSE: 157.5,
    S: 180,
    SSW: 202.5,
    SW: 225,
    WSW: 247.5,
    W: 270,
    WNW: 292.5,
    NW: 315,
    NNW: 337.5,
  };
  const cleaned = direction.toUpperCase().replace(/[^NESW]/g, "");
  return map[cleaned] || 0;
}

// Helper function to extract cardinal direction from text
export function getDirectionAbbrev(direction: string | null): string {
  if (!direction) return "W";
  const match = direction.match(/([NESW]{1,3})/i);
  return match ? match[1].toUpperCase() : "W";
}

// Helper function to describe wind conditions
export function getWindDescription(
  speed: number,
  direction: string,
  offshoreDeg?: number | null
): string {
  if (speed < 5) return "Calm";

  // If we have offshore preference, calculate if it's offshore
  if (offshoreDeg !== null && offshoreDeg !== undefined) {
    const windDeg = getWindDirectionDegrees(direction);
    const diff = Math.abs(windDeg - offshoreDeg);
    const adjustedDiff = diff > 180 ? 360 - diff : diff;

    if (adjustedDiff <= 45 && speed < 15) {
      return "Light offshore";
    } else if (adjustedDiff <= 45) {
      return "Offshore";
    }
  }

  if (speed < 10) return `${speed}-${speed + 2} mph`;
  if (speed < 15) return `${speed} mph cross-shore`;
  return "Strong onshore";
}

// Helper function to determine crowd level (can be enhanced with real session data)
export function getCrowdLevel(
  beachName: string
): "Uncrowded" | "Moderate" | "Crowded" {
  const crowdedBeaches = ["Swami", "Black", "Windansea", "Sunset Cliffs"];
  const moderateBeaches = ["Tourmaline", "Pacific Beach", "Mission Beach"];

  if (crowdedBeaches.some((b) => beachName.includes(b))) return "Crowded";
  if (moderateBeaches.some((b) => beachName.includes(b))) return "Moderate";
  return "Uncrowded";
}


