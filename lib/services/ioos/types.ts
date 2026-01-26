/**
 * IOOS Service Types
 *
 * Type definitions for the IOOS service module.
 * These complement the types in @/types/ioos.ts with internal types.
 *
 * @module ioos/types
 */

import { CanonicalVar } from "@/lib/constants/ioos-config";
import { IOOSObservation } from "@/types/ioos";

/**
 * Parsed observation with canonical field names
 * Used internally for data processing before conversion to IOOSObservation
 */
export interface ParsedObservation {
  /** ISO timestamp of the observation */
  observedAt: string;
  /** Wave height in meters */
  waveHeightM: number | null;
  /** Wave period in seconds */
  wavePeriodS: number | null;
  /** Wave direction in degrees */
  waveDirectionDeg: number | null;
  /** Water temperature in Celsius */
  waterTempC: number | null;
  /** Wind speed in meters per second */
  windSpeedMS: number | null;
  /** Wind direction in degrees */
  windDirectionDeg: number | null;
  /** Raw data from ERDDAP API */
  raw: Record<string, unknown>;
}

/**
 * Cache entry for observations
 * Used internally for caching observation data
 */
export interface CacheEntry {
  /** Unix timestamp (ms) when cached */
  at: number;
  /** Cached observation data (null if fetch failed) */
  data: IOOSObservation | ParsedObservation | null;
}

/**
 * Result from fetching station variables
 */
export interface StationVariablesResult {
  /** List of all available variable names from ERDDAP */
  availableVariables: string[];
  /** Mapping of canonical variable names to ERDDAP variable names */
  variableMap: Partial<Record<CanonicalVar, string>>;
}
