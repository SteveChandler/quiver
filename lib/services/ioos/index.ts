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

export { IOOSService } from "./ioos-service";
export type { ParsedObservation } from "./types";
export { buildVariableMap, parseObservationRow } from "./data-parser";
export { buildDynamicObservationUrl } from "./url-builder";
