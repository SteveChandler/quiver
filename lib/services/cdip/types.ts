/**
 * Type definitions for CDIP (Coastal Data Information Program) service
 *
 * Re-exports types from the main forecast types file for cleaner imports.
 */

import type {
  CDIPBuoyData,
  CDIPDataPoint,
  CDIPDataResponse,
  CDIPMetaResponse,
  CDIPStationConfig,
} from "@/types/forecast";

// Re-export types
export type {
  CDIPBuoyData,
  CDIPDataPoint,
  CDIPDataResponse,
  CDIPMetaResponse,
  CDIPStationConfig,
};

/**
 * Cache entry for CDIP buoy data
 */
export interface CDIPCacheEntry {
  data: CDIPBuoyData;
  timestamp: number;
}
