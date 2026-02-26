/**
 * Water Quality Sync Module
 *
 * Provides data ingestion from CEDEN (California) and PacIOOS ERDDAP (Hawaii)
 * for coastal bacteria monitoring, with station discovery, sample fetching,
 * and EPA-criteria evaluation.
 *
 * @module water-quality
 *
 * @example
 * ```ts
 * import { syncWQStations, syncWQSamples, evaluateWaterQuality } from '@/lib/services/water-quality';
 *
 * const stationResult = await syncWQStations(supabase);
 * const sampleResult = await syncWQSamples(supabase);
 * const evalResult = await evaluateWaterQuality(supabase);
 * ```
 */

export {
  syncWQStations,
  syncWQSamples,
  evaluateWaterQuality,
} from "./water-quality-sync-service";

export type {
  StationSyncResult,
  SampleSyncResult,
  EvaluationResult,
} from "./water-quality-sync-service";
