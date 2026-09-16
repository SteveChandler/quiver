/**
 * CDIP (Coastal Data Information Program) Service
 *
 * Provides high-quality wave data from buoy stations along the California coast.
 * Operated by Scripps Institution of Oceanography.
 *
 * @module cdip
 */

// Re-export the main service class
export { CDIPService } from "./cdip-service";

// Re-export types for consumers

// Re-export constants for advanced usage

// Re-export utilities for testing and advanced usage
export {
  transformToCDIPBuoyData,



} from "./data-parser";
;
