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

export type CDIPSkipReason =
  | "success"
  | "no_station"
  | "unknown_station"
  | "blacklisted_station"
  | "cdip_400"
  | "cdip_404"
  | "circuit_open"
  | "cdip_unavailable"
  | "trusted_forecast_failed";

export interface CDIPFetchDiagnostic<TData> {
  data: TData | null;
  stationId: string | null;
  skipReason: CDIPSkipReason;
  breakerKey?: string;
  errorMessage?: string;
  status?: number;
}

export type CDIPWaveDataDiagnostic = CDIPFetchDiagnostic<CDIPDataResponse>;
export type CDIPBuoyDataDiagnostic = CDIPFetchDiagnostic<CDIPBuoyData>;

/**
 * Cache entry for CDIP buoy data
 */
export interface CDIPCacheEntry {
  data: CDIPBuoyData;
  timestamp: number;
}
