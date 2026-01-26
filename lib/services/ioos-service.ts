/**
 * IOOS Service (Legacy Re-export)
 *
 * This file maintains backwards compatibility by re-exporting from the modular implementation.
 * New code should import directly from '@/lib/services/ioos' instead.
 *
 * @deprecated Import from '@/lib/services/ioos' instead
 * @module ioos-service
 */

// Re-export everything from the modular implementation
export {
  IOOSService,
  getIOOSService,
  buildDynamicObservationUrl,
  buildVariableMap,
  parseObservationRow,
  type ParsedObservation,
} from "./ioos";
