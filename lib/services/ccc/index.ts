/**
 * CCC Coastal Commission Sync Module
 *
 * Provides data ingestion from the California Coastal Commission public access
 * locations API, with normalization, upsert, and proximity-based beach matching.
 *
 * @module ccc
 *
 * @example
 * ```ts
 * import { fetchCCCLocations, upsertCCCLocations, matchCCCToBeaches } from '@/lib/services/ccc';
 *
 * const fetchResult = await fetchCCCLocations();
 * const upsertResult = await upsertCCCLocations(supabase, fetchResult.locations);
 * const matchResult = await matchCCCToBeaches(supabase);
 * ```
 */

export {
  fetchCCCLocations,
  upsertCCCLocations,
  matchCCCToBeaches,
} from "./ccc-sync-service";

export type {
  NormalizedCCCLocation,
  FetchResult,
  UpsertResult,
  MatchResult,
} from "./ccc-sync-service";
