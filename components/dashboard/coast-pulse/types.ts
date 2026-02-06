import type { IntelEmojiRating } from "@/types/database";

/**
 * Source type for Coast Pulse items
 */
export type SourceType = "local" | "cdip" | "ndbc" | "forecast" | "intel" | "wind" | "tide" | "daily-intel";

/**
 * Coast Pulse item from API
 */
export interface CoastPulseItem {
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
  emoji_rating?: IntelEmojiRating;
}

/**
 * Summary data from API
 */
export interface CoastPulseSummary {
  waveHeight: string | null;
  windSpeed: string | null;
  tideHeight: string | null;
  waterTemp: string | null;
  trend: "improving" | "stable" | "declining" | null;
  lastUpdated: string;
}

/**
 * API response structure
 */
export interface CoastPulseResponse {
  success: boolean;
  data: {
    items: CoastPulseItem[];
    summary: CoastPulseSummary;
    hasMore: boolean;
    nextCursor: string | null;
    nearbyBeachIds?: string[];
  };
}
