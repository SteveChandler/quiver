/**
 * Type definitions for Coast Pulse data
 */

// Re-export the shared summary types used by both the main API and summary endpoint
export type {
  CoastPulseSummary,
  CoastPulseSummaryItem,
} from "@/lib/utils/coast-pulse-summary";

export interface CoastPulseSource {
  name: string;
  type: "local" | "cdip" | "ndbc" | "forecast" | "intel" | "wind" | "tide" | "daily-intel";
  credibility: number; // 0-100
}

export interface CoastPulseItem {
  id: string;
  source: CoastPulseSource;
  message: string;
  timestamp: Date;
  location?: {
    lat: number;
    lon: number;
    distanceKm: number;
  };
  trend?: "up" | "down" | "stable";
  windSpeedMph?: number | null;
  windDirection?: string | null;
  windObservedAt?: string | null;
  windSource?: string | null;
  photoUrl?: string;
  emoji_rating?: "fire" | "shaka" | "meh" | "thumbsdown";
}

export interface CoastPulseResponse {
  items: CoastPulseItem[];
  summary: import("@/lib/utils/coast-pulse-summary").CoastPulseSummary;
  hasMore: boolean;
  nextCursor: string | null;
  nearbyBeachIds: string[];
}

/** Cached beach data used across multiple fetch functions */
export interface BeachCacheEntry {
  id: string;
  name: string;
  lat: number;
  lon: number;
  windOffshoreDeg?: number | null;
  timezone?: string | null;
}

/** Parameters for the generateCoastPulse service function */
export interface CoastPulseParams {
  lat: number;
  lon: number;
  limit: number;
  before?: string;
}
