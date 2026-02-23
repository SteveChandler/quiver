/**
 * IOOS Service Module
 *
 * Fetches wave buoy data from IOOS (Integrated Ocean Observing System) ERDDAP API.
 * Provides station discovery, observation fetching, and database integration.
 *
 * @module ioos
 *
 * @example
 * ```ts
 * import { IOOSService, buildDynamicObservationUrl } from '@/lib/services/ioos';
 *
 * const service = new IOOSService();
 * const stations = await service.discoverStations();
 * const obs = await service.fetchObservation(stationId);
 * ```
 */

// Main service class
export { IOOSService } from "./ioos-service";

// Export types for consumers
export type { ParsedObservation, CacheEntry, StationVariablesResult } from "./types";

// Export data parsing utilities
export {
  isoZulu,
  buildVariableMap,
  parseObservationRow,
  parseObservationArray,
  parseNetwork,
  rowToObject,
} from "./data-parser";

// Export URL builders
export { buildDynamicObservationUrl, buildObservationUrl, buildStationInfoUrl, buildAllDatasetsUrl } from "./url-builder";

// Export API client utilities (for advanced usage)
export { fetchAllDatasets, fetchObservation, fetchStationInfo, isUnrecognizedVariableError } from "./api-client";

// Export cache class (for advanced usage)
export { ObservationCache } from "./cache";

// Re-export constants for convenience
export { NETWORK_PATTERNS, STATION_ID_PATTERN, STATION_FILTERS, ISM_FILTER_WARNING_THRESHOLD, NEARBY_STATIONS_LIMIT } from "./constants";

// Import for singleton
import { IOOSService as IOOSServiceClass } from "./ioos-service";

// Singleton instance
let defaultService: IOOSServiceClass | null = null;

/**
 * Get the default IOOS service instance (singleton)
 *
 * @returns Shared IOOSService instance
 *
 * @example
 * ```ts
 * import { getIOOSService } from '@/lib/services/ioos';
 *
 * const service = getIOOSService();
 * const obs = await service.fetchObservation(stationId);
 * ```
 */
export function getIOOSService(): IOOSServiceClass {
  if (!defaultService) {
    defaultService = new IOOSServiceClass();
  }
  return defaultService;
}
