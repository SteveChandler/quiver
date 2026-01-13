/**
 * Transform utilities for converting CoastPulse API data to LivePulseCarousel format
 */

/**
 * Source types from the CoastPulse API
 */
type SourceType = "local" | "cdip" | "ndbc" | "forecast" | "intel" | "wind" | "tide";

/**
 * CoastPulse item from API (matches coast-pulse.tsx types)
 */
interface CoastPulseItem {
  id: string;
  source: {
    name: string;
    type: SourceType;
    credibility: number;
  };
  message: string;
  timestamp: string;
  location?: {
    lat: number;
    lon: number;
    distanceKm: number;
  };
  trend?: "up" | "down" | "stable";
  photoUrl?: string;
}

/**
 * Live Pulse carousel item format
 */
export interface LivePulseItem {
  id: string;
  type: "intel" | "buoy";
  name: string;
  time: string;
  // Intel-specific fields
  text?: string;
  subtitle?: string;
  // Buoy-specific fields
  metric?: {
    height: number;
    period: number;
    wind: number;
    windDir: number;
  };
}

/**
 * Source types that map to buoy cards
 */
const BUOY_SOURCES: SourceType[] = ["cdip", "ndbc", "local", "wind", "tide"];

/**
 * Source types that map to intel cards
 */
const INTEL_SOURCES: SourceType[] = ["intel"];

/**
 * Parse wave height from message string
 * Handles formats like: "4.2ft", "3-5ft", "4.2 ft"
 */
function parseHeight(message: string): number | null {
  // Try to match single value first: "4.2ft" or "4.2 ft"
  const singleMatch = message.match(/(\d+\.?\d*)\s*ft/i);
  if (singleMatch) {
    return parseFloat(singleMatch[1]);
  }

  // Try range format: "3-5ft" - return average
  const rangeMatch = message.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)\s*ft/i);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    return (low + high) / 2;
  }

  return null;
}

/**
 * Parse wave period from message string
 * Handles formats like: "12s", "12 s", "@ 12s"
 */
function parsePeriod(message: string): number | null {
  const match = message.match(/@?\s*(\d+\.?\d*)\s*s(?:ec)?/i);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Parse wind speed from message string
 * Handles formats like: "8kt", "8 kt", "8 kts", "8mph"
 */
function parseWind(message: string): number | null {
  // Try knots first
  const ktMatch = message.match(/(\d+\.?\d*)\s*kt/i);
  if (ktMatch) {
    return parseFloat(ktMatch[1]);
  }

  // Try mph (convert to knots)
  const mphMatch = message.match(/(\d+\.?\d*)\s*mph/i);
  if (mphMatch) {
    return Math.round(parseFloat(mphMatch[1]) * 0.868976);
  }

  return null;
}

/**
 * Parse wind direction from message string
 * Handles formats like: "(215°)", "from NW", "215°"
 */
function parseWindDirection(message: string): number | null {
  // Try degree format first
  const degMatch = message.match(/(\d{1,3})\s*°/);
  if (degMatch) {
    return parseInt(degMatch[1], 10);
  }

  // Try cardinal direction
  const cardinalMap: Record<string, number> = {
    N: 0, NNE: 22, NE: 45, ENE: 67,
    E: 90, ESE: 112, SE: 135, SSE: 157,
    S: 180, SSW: 202, SW: 225, WSW: 247,
    W: 270, WNW: 292, NW: 315, NNW: 337,
  };

  const cardinalMatch = message.match(/from\s+(N|NNE|NE|ENE|E|ESE|SE|SSE|S|SSW|SW|WSW|W|WNW|NW|NNW)/i);
  if (cardinalMatch) {
    return cardinalMap[cardinalMatch[1].toUpperCase()] ?? null;
  }

  return null;
}

/**
 * Transform a single CoastPulseItem to LivePulseItem
 */
function transformItem(item: CoastPulseItem): LivePulseItem | null {
  const { id, source, message, timestamp } = item;

  // Determine item type
  if (INTEL_SOURCES.includes(source.type)) {
    // Intel card - extract quote and user info
    return {
      id,
      type: "intel",
      name: item.location ? `${Math.round((item.location.distanceKm || 0) * 0.621371)} mi away` : source.name,
      time: timestamp,
      text: message,
      subtitle: source.name,
    };
  }

  if (BUOY_SOURCES.includes(source.type)) {
    // Buoy card - parse metrics from message
    const height = parseHeight(message);
    const period = parsePeriod(message);
    const wind = parseWind(message);
    const windDir = parseWindDirection(message);

    // Only create buoy card if we have at least height data
    if (height !== null) {
      return {
        id,
        type: "buoy",
        name: source.name,
        time: timestamp,
        metric: {
          height,
          period: period ?? 0,
          wind: wind ?? 0,
          windDir: windDir ?? 0,
        },
      };
    }
  }

  // Forecast type - treat as buoy if it has wave data
  if (source.type === "forecast") {
    const height = parseHeight(message);
    if (height !== null) {
      return {
        id,
        type: "buoy",
        name: source.name,
        time: timestamp,
        metric: {
          height,
          period: parsePeriod(message) ?? 0,
          wind: parseWind(message) ?? 0,
          windDir: parseWindDirection(message) ?? 0,
        },
      };
    }
  }

  return null;
}

/**
 * Transform array of CoastPulseItems to LivePulseItems
 * Filters out items that can't be properly parsed
 */
export function transformToLivePulseItems(items: CoastPulseItem[]): LivePulseItem[] {
  return items
    .map(transformItem)
    .filter((item): item is LivePulseItem => item !== null);
}

/**
 * Export types for use in other modules
 */
export type { CoastPulseItem, SourceType };
