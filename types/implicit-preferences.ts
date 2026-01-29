/**
 * TypeScript Types for Implicit Preference Learning
 *
 * This module defines types for tracking user behavior and learning
 * implicit preferences from those interactions.
 *
 * @see docs/plans/2026-01-25-implicit-preference-learning-design.md
 */

// =============================================================================
// Event Types
// =============================================================================

/**
 * Valid implicit event types that can be tracked
 */
export type ImplicitEventType =
  | 'beach_view'
  | 'discovery_click'
  | 'discovery_skip'
  | 'forecast_check'
  | 'location_update';

/**
 * Weight multipliers for each event type, determining how much
 * each interaction contributes to learned preferences
 */
export const EVENT_WEIGHTS: Record<ImplicitEventType, number> = {
  location_update: 10.0,
  discovery_click: 3.0,
  forecast_check: 2.5,
  beach_view: 0.5,
  discovery_skip: -1.0,
} as const;

// -----------------------------------------------------------------------------
// Event Metadata Interfaces
// -----------------------------------------------------------------------------

/**
 * Metadata for beach_view events
 */
export interface BeachViewMetadata {
  /** How long the user viewed the beach detail page */
  duration_ms?: number;
  /** Where the user came from (discovery, search, direct, etc.) */
  referrer?: string;
  /** Whether the user viewed forecast data */
  forecast_viewed?: boolean;
}

/**
 * Metadata for discovery_click events
 */
export interface DiscoveryClickMetadata {
  /** Position in the discovery list (0-indexed) */
  position: number;
  /** The personalization score shown to the user */
  score_shown: number;
  /** How many alternatives were available */
  alternatives_count: number;
}

/**
 * Metadata for discovery_skip events (when user scrolls past a recommendation)
 */
export interface DiscoverySkipMetadata {
  /** Position in the discovery list (0-indexed) */
  position: number;
  /** The personalization score of the skipped beach */
  score_shown: number;
  /** ID of the beach the user chose instead (if any) */
  chosen_beach_id?: string;
}

/**
 * Metadata for forecast_check events
 */
export interface ForecastCheckMetadata {
  /** Time slot the user was checking (dawn-patrol, morning, etc.) */
  time_slot?: string;
  /** Summary of conditions at time of check */
  conditions_summary?: string;
}

/**
 * Metadata for location_update events
 */
export interface LocationUpdateMetadata {
  /** User's latitude */
  lat: number;
  /** User's longitude */
  lon: number;
  /** GPS accuracy in meters */
  accuracy_m?: number;
}

/**
 * Union type of all possible event metadata
 */
export type EventMetadata =
  | BeachViewMetadata
  | DiscoveryClickMetadata
  | DiscoverySkipMetadata
  | ForecastCheckMetadata
  | LocationUpdateMetadata;

/**
 * Full user event record as stored in the database
 */
export interface UserEvent {
  id: string;
  user_id: string;
  event_type: ImplicitEventType;
  beach_id: string | null;
  metadata: EventMetadata;
  created_at: string;
  expires_at: string;
}

// =============================================================================
// Implicit Preferences Types
// =============================================================================

/**
 * Valid break types for implicit preference learning
 */
export type ValidBreakType = 'beach' | 'point' | 'reef';

/**
 * Valid time slots for implicit preference learning
 */
export type ValidTimeSlot = 'dawn-patrol' | 'morning' | 'afternoon' | 'evening';

/**
 * Learned weights for different break types
 * Strict type definition - only valid break types allowed
 */
export interface BreakTypeWeights {
  beach?: number;
  point?: number;
  reef?: number;
}

/**
 * Learned weights for different time slots
 * Strict type definition - only valid time slots allowed
 */
export interface TimeSlotWeights {
  'dawn-patrol'?: number;
  morning?: number;
  afternoon?: number;
  evening?: number;
}

/**
 * Full implicit preferences record as stored in the database
 */
export interface UserImplicitPreferences {
  user_id: string;
  inferred_wave_min_ft: number | null;
  inferred_wave_max_ft: number | null;
  break_type_weights: BreakTypeWeights;
  time_slot_weights: TimeSlotWeights;
  location_centroid_lat: number | null;
  location_centroid_lon: number | null;
  typical_travel_radius_miles: number | null;
  top_engaged_beach_ids: string[];
  confidence: number;
  event_count: number;
  last_computed_at: string;
  computed_from: string | null;
  computed_to: string | null;
}

// =============================================================================
// API Types
// =============================================================================

/**
 * Request body for tracking an implicit event
 */
export interface TrackEventRequest {
  eventType: ImplicitEventType;
  beachId?: string;
  metadata?: EventMetadata;
}

/**
 * Response from tracking an implicit event
 */
export interface TrackEventResponse {
  ok: boolean;
  /** Set when tracking is disabled (e.g., user opted out) */
  status?: 'tracking_disabled';
}

// =============================================================================
// Scoring & Personalization Types
// =============================================================================

/**
 * Reason why a beach matched the user's preferences
 */
export interface MatchReason {
  /** Category of the match reason */
  type: 'learned' | 'implicit' | 'onboarding' | 'affinity';
  /** Human-readable label */
  label: string;
  /** Confidence level */
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Extended scoring breakdown including implicit learning components
 */
export interface ExtendedScoringBreakdown {
  /** Base score from conditions/forecast */
  base: number;
  /** Score contribution from onboarding preferences */
  onboarding: number;
  /** Score contribution from explicitly learned preferences */
  learned: number;
  /** Score contribution from implicit behavior tracking */
  implicit: number;
  /** Final affinity score combining all factors */
  affinity: number;
}

/**
 * Source of personalization data used in scoring
 */
export type PersonalizationSource = 'explicit' | 'implicit' | 'blended' | 'none';

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if metadata is BeachViewMetadata
 */
export function isBeachViewMetadata(
  metadata: EventMetadata | null
): metadata is BeachViewMetadata {
  if (!metadata) return false;
  return (
    'duration_ms' in metadata ||
    'referrer' in metadata ||
    'forecast_viewed' in metadata
  );
}

/**
 * Type guard to check if metadata is DiscoveryClickMetadata
 */
export function isDiscoveryClickMetadata(
  metadata: EventMetadata | null
): metadata is DiscoveryClickMetadata {
  if (!metadata) return false;
  return (
    'position' in metadata &&
    'score_shown' in metadata &&
    'alternatives_count' in metadata
  );
}

/**
 * Type guard to check if metadata is DiscoverySkipMetadata
 */
export function isDiscoverySkipMetadata(
  metadata: EventMetadata | null
): metadata is DiscoverySkipMetadata {
  if (!metadata) return false;
  return (
    'position' in metadata &&
    'score_shown' in metadata &&
    !('alternatives_count' in metadata)
  );
}

/**
 * Type guard to check if metadata is ForecastCheckMetadata
 */
export function isForecastCheckMetadata(
  metadata: EventMetadata | null
): metadata is ForecastCheckMetadata {
  if (!metadata) return false;
  return 'time_slot' in metadata || 'conditions_summary' in metadata;
}

/**
 * Type guard to check if metadata is LocationUpdateMetadata
 */
export function isLocationUpdateMetadata(
  metadata: EventMetadata | null
): metadata is LocationUpdateMetadata {
  if (!metadata) return false;
  return 'lat' in metadata && 'lon' in metadata;
}

/**
 * Validates that an event type is a valid ImplicitEventType
 */
export function isValidEventType(type: string): type is ImplicitEventType {
  return type in EVENT_WEIGHTS;
}
