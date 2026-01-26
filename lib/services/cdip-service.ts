/**
 * CDIP (Coastal Data Information Program) Service
 *
 * Legacy export file for backwards compatibility.
 * New code should import from '@/lib/services/cdip' instead.
 *
 * @deprecated Import from '@/lib/services/cdip' instead
 */

export { CDIPService, transformToCDIPBuoyData } from "./cdip";
export type {
  CDIPBuoyData,
  CDIPDataPoint,
  CDIPDataResponse,
  CDIPMetaResponse,
  CDIPStationConfig,
} from "./cdip";
