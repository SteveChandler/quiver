import { FollowTopic } from '@/types/beach-follow';

// =============================================================================
// Event Configuration
// =============================================================================

export const BFR_WEB_EVENT_TYPES = [
  'beach_follow_started',
  'beach_follow_saved_local',
  'beach_follow_sync_started',
  'beach_follow_sync_completed',
  'follow_topic_changed',
  'visitor_intent_selected',
  'surf_intent_qualified',
  'my_coast_viewed',
  'my_coast_beach_opened',
] as const;

export const BFR_ANONYMOUS_EVENT_TYPES = [
  'beach_follow_started',
  'beach_follow_saved_local',
  'follow_topic_changed',
  'visitor_intent_selected',
  'surf_intent_qualified',
  'my_coast_viewed',
  'my_coast_beach_opened',
] as const;

export const BFR_INTENT_STATES = ['explicit', 'inferred', 'unknown'] as const;
export const BFR_WEB_AUDIENCE_CLASSES = [
  'general_utility',
  'surf_qualified',
  'existing_web_user',
] as const;
export const BFR_WEB_EXPERIMENT_KEY = 'bfr-follow-holdout-v1' as const;
export const BFR_WEB_EXPERIMENT_ARMS = ['holdout', 'treatment'] as const;
export const BFR_INTENT_REASONS = [
  'explicit_surfing',
  'explicit_non_surf',
  'high_intent_action',
  'multiple_surf_signals',
  'insufficient_surf_signals',
  'utility_only',
  'no_evidence',
] as const;
export const BFR_TOPICS: readonly FollowTopic[] = Object.values(FollowTopic);
export const BFR_PAGE_TYPES = [
  'beach_detail',
  'beach_water_temp',
  'city_water_temp',
  'my_coast',
  'other',
] as const;
export const BFR_FALLBACK_CLASSIFICATIONS = [
  'exact',
  'replaced',
  'beach_only',
  'invalid',
] as const;
export const BFR_HANDOFF_RESOLUTION_REASONS = [
  'window_replaced',
  'expired',
  'window_removed',
  'malformed',
  'unsupported_version',
  'beach_removed',
] as const;
export const BFR_HANDOFF_CONTEXTS = ['exact_call'] as const;
export const BFR_EXACT_CALL_HANDOFF_EVENTS = {
  started: 'app_handoff_link_opened',
  nativeOpened: 'app_handoff_native_open',
  resolved: 'watched_call_context_resolved',
} as const;

export type BfrIntentState = (typeof BFR_INTENT_STATES)[number];
export type BfrIntentReason = (typeof BFR_INTENT_REASONS)[number];
export type BfrWebAudienceClass =
  (typeof BFR_WEB_AUDIENCE_CLASSES)[number];
export type BfrWebExperimentArm =
  (typeof BFR_WEB_EXPERIMENT_ARMS)[number];
export type BfrWebEventType = (typeof BFR_WEB_EVENT_TYPES)[number];
export type BfrTopic = (typeof BFR_TOPICS)[number];
export type BfrPageType = (typeof BFR_PAGE_TYPES)[number];
export type BfrFallbackClassification =
  (typeof BFR_FALLBACK_CLASSIFICATIONS)[number];
export type BfrHandoffResolutionReason =
  (typeof BFR_HANDOFF_RESOLUTION_REASONS)[number];
export type BfrHandoffContext = (typeof BFR_HANDOFF_CONTEXTS)[number];
export type BfrHandoffResolutionMetadata =
  | { fallback_classification: 'exact'; reason?: never }
  | { fallback_classification: 'replaced'; reason: 'window_replaced' }
  | {
      fallback_classification: 'beach_only';
      reason: 'expired' | 'window_removed';
    }
  | {
      fallback_classification: 'invalid';
      reason: 'malformed' | 'unsupported_version' | 'beach_removed';
    };

type BfrWebExperimentMetadata = {
  experiment_key: typeof BFR_WEB_EXPERIMENT_KEY;
  experiment_arm: BfrWebExperimentArm;
};

type BfrWebBaseMetadata = BfrWebExperimentMetadata & {
  audience_class: BfrWebAudienceClass;
  page_type: BfrPageType;
};

type BfrIntentMetadata =
  | {
      intent_state: 'explicit';
      intent_reason: 'explicit_surfing' | 'explicit_non_surf';
    }
  | {
      intent_state: 'inferred';
      intent_reason: 'high_intent_action' | 'multiple_surf_signals';
    }
  | {
      intent_state: 'unknown';
      intent_reason:
        | 'insufficient_surf_signals'
        | 'utility_only'
        | 'no_evidence';
    };

type BfrQualifiedIntentMetadata =
  | {
      intent_state: 'explicit';
      intent_reason: 'explicit_surfing';
    }
  | {
      intent_state: 'inferred';
      intent_reason: 'high_intent_action' | 'multiple_surf_signals';
    };

type BfrExplicitIntentMetadata = {
  intent_state: 'explicit';
  intent_reason: 'explicit_surfing' | 'explicit_non_surf';
};

type BfrWebTopicMetadata = BfrWebBaseMetadata & { topic: BfrTopic };
type BfrWebSyncMetadata = BfrWebBaseMetadata & {
  audience_class: 'existing_web_user';
};
type BfrWebMyCoastMetadata = BfrWebBaseMetadata &
  BfrIntentMetadata & { page_type: 'my_coast' };

export type BfrWebEventMetadataMap = {
  beach_follow_started: BfrWebTopicMetadata;
  beach_follow_saved_local: BfrWebTopicMetadata;
  beach_follow_sync_started: BfrWebSyncMetadata;
  beach_follow_sync_completed: BfrWebSyncMetadata;
  follow_topic_changed: BfrWebTopicMetadata;
  visitor_intent_selected: BfrWebBaseMetadata & BfrExplicitIntentMetadata;
  surf_intent_qualified: BfrWebBaseMetadata &
    BfrQualifiedIntentMetadata & { audience_class: 'surf_qualified' };
  my_coast_viewed: BfrWebMyCoastMetadata;
  my_coast_beach_opened: BfrWebMyCoastMetadata & { topic: BfrTopic };
};

const BFR_WEB_BASE_KEYS = [
  'audience_class',
  'page_type',
  'experiment_key',
  'experiment_arm',
] as const;
const BFR_WEB_TOPIC_KEYS = [...BFR_WEB_BASE_KEYS, 'topic'] as const;
const BFR_WEB_INTENT_KEYS = [
  ...BFR_WEB_BASE_KEYS,
  'intent_state',
  'intent_reason',
] as const;
const BFR_WEB_EVENT_METADATA_KEYS: Readonly<
  Record<BfrWebEventType, readonly string[]>
> = {
  beach_follow_started: BFR_WEB_TOPIC_KEYS,
  beach_follow_saved_local: BFR_WEB_TOPIC_KEYS,
  beach_follow_sync_started: BFR_WEB_BASE_KEYS,
  beach_follow_sync_completed: BFR_WEB_BASE_KEYS,
  follow_topic_changed: BFR_WEB_TOPIC_KEYS,
  visitor_intent_selected: BFR_WEB_INTENT_KEYS,
  surf_intent_qualified: BFR_WEB_INTENT_KEYS,
  my_coast_viewed: BFR_WEB_INTENT_KEYS,
  my_coast_beach_opened: [...BFR_WEB_INTENT_KEYS, 'topic'],
};
const BFR_WEB_ALLOWED_VALUES: Readonly<Record<string, ReadonlySet<string>>> = {
  audience_class: new Set(BFR_WEB_AUDIENCE_CLASSES),
  page_type: new Set(BFR_PAGE_TYPES),
  experiment_key: new Set([BFR_WEB_EXPERIMENT_KEY]),
  experiment_arm: new Set(BFR_WEB_EXPERIMENT_ARMS),
  topic: new Set(BFR_TOPICS),
  intent_state: new Set(BFR_INTENT_STATES),
  intent_reason: new Set(BFR_INTENT_REASONS),
};
const BFR_WEB_INTENT_REASONS_BY_STATE: Readonly<
  Record<BfrIntentState, ReadonlySet<BfrIntentReason>>
> = {
  explicit: new Set(['explicit_surfing', 'explicit_non_surf']),
  inferred: new Set(['high_intent_action', 'multiple_surf_signals']),
  unknown: new Set([
    'insufficient_surf_signals',
    'utility_only',
    'no_evidence',
  ]),
};

function hasValidBfrWebIntentPair(
  metadata: Record<string, unknown>,
): boolean {
  if (metadata.intent_state === undefined && metadata.intent_reason === undefined) {
    return true;
  }
  if (
    typeof metadata.intent_state !== 'string'
    || typeof metadata.intent_reason !== 'string'
  ) {
    return false;
  }
  return Boolean(
    BFR_WEB_INTENT_REASONS_BY_STATE[
      metadata.intent_state as BfrIntentState
    ]?.has(metadata.intent_reason as BfrIntentReason),
  );
}

function hasValidBfrWebEventSemantics(
  eventType: BfrWebEventType,
  metadata: Record<string, unknown>,
): boolean {
  if (
    (eventType === 'beach_follow_sync_started'
      || eventType === 'beach_follow_sync_completed')
    && metadata.audience_class !== 'existing_web_user'
  ) {
    return false;
  }
  if (
    (eventType === 'my_coast_viewed'
      || eventType === 'my_coast_beach_opened')
    && metadata.page_type !== 'my_coast'
  ) {
    return false;
  }
  if (
    eventType === 'visitor_intent_selected'
    && (
      metadata.intent_state !== 'explicit'
      || (
        metadata.intent_reason !== 'explicit_surfing'
        && metadata.intent_reason !== 'explicit_non_surf'
      )
    )
  ) {
    return false;
  }
  if (eventType === 'surf_intent_qualified') {
    const isQualified = metadata.audience_class === 'surf_qualified'
      && (
        (metadata.intent_state === 'explicit'
          && metadata.intent_reason === 'explicit_surfing')
        || (
          metadata.intent_state === 'inferred'
          && (
            metadata.intent_reason === 'high_intent_action'
            || metadata.intent_reason === 'multiple_surf_signals'
          )
        )
      );
    if (!isQualified) return false;
  }

  return hasValidBfrWebIntentPair(metadata);
}

export function buildBfrWebEventMetadata<EventType extends BfrWebEventType>(
  metadata: BfrWebEventMetadataMap[EventType],
  eventType: EventType,
): BfrWebEventMetadataMap[EventType] | null {
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
    return null;
  }
  const metadataRecord = metadata as Record<string, unknown>;
  const allowedKeys = BFR_WEB_EVENT_METADATA_KEYS[eventType];
  if (Object.keys(metadataRecord).some((key) => !allowedKeys.includes(key))) {
    return null;
  }
  if (allowedKeys.some((key) => typeof metadataRecord[key] !== 'string')) {
    return null;
  }
  if (allowedKeys.some((key) => (
    !BFR_WEB_ALLOWED_VALUES[key]?.has(metadataRecord[key] as string)
  ))) {
    return null;
  }
  if (!hasValidBfrWebEventSemantics(eventType, metadataRecord)) return null;

  return Object.fromEntries(
    allowedKeys.map((key) => [key, metadataRecord[key]]),
  ) as BfrWebEventMetadataMap[EventType];
}

const BFR_WEB_EVENT_TYPE_SET = new Set<string>(BFR_WEB_EVENT_TYPES);
const BFR_EXACT_CALL_RECEIPT_EVENT_TYPES = new Set<string>([
  BFR_EXACT_CALL_HANDOFF_EVENTS.started,
  BFR_EXACT_CALL_HANDOFF_EVENTS.nativeOpened,
]);
const BFR_HANDOFF_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const BFR_APP_VERSION_PATTERN =
  /^[0-9]+\.[0-9]+\.[0-9]+(?:\+[0-9]+)?$/;
const BFR_EXPO_RUNTIME_VERSION_PATTERN =
  /^(?:[0-9a-f]{40}|[0-9a-f]{64}|\d+\.\d+\.\d+)$/;
const BFR_EXPO_CHANNEL_VALUES = new Set<string>([
  'production',
  'preview',
  'development',
]);
const BFR_EXACT_CALL_PLACEMENT_VALUES = new Set<string>(['exact_call']);
const BFR_NATIVE_PLATFORM_VALUES = new Set<string>([
  'native-ios',
  'native-android',
]);
const BFR_NATIVE_CHANNEL_KEYS = new Set<string>([
  'source',
  '_platform',
  'app_version',
  'expo_update_id',
  'expo_channel',
  'expo_runtime_version',
  'expo_is_embedded_launch',
  'expo_is_emergency_launch',
  'is_emulator',
  'launch_primer_session_id',
]);
const BFR_EXACT_CALL_NATIVE_OPEN_KEYS = new Set<string>([
  'handoff_id',
  'source',
  'surface',
  'placement',
  'handoff_context',
  ...BFR_NATIVE_CHANNEL_KEYS,
]);
const BFR_EXACT_CALL_LINK_OPENED_KEYS = new Set<string>([
  'handoff_id',
  'source',
  'surface',
  'placement',
  'handoff_context',
]);
const BFR_HANDOFF_RESOLUTION_KEYS = new Set<string>([
  'handoff_id',
  'fallback_classification',
  'reason',
  ...BFR_NATIVE_CHANNEL_KEYS,
]);
const BFR_ONLY_EVENT_SET = new Set<string>([
  ...BFR_WEB_EVENT_TYPES,
  BFR_EXACT_CALL_HANDOFF_EVENTS.resolved,
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

export function hasValidBfrHandoffResolutionPair(
  metadata: Record<string, unknown>,
): metadata is Record<string, unknown> & BfrHandoffResolutionMetadata {
  const classification = metadata.fallback_classification;
  const reason = metadata.reason;
  if (classification === 'exact') return reason === undefined;
  if (classification === 'replaced') return reason === 'window_replaced';
  if (classification === 'beach_only') {
    return reason === 'expired' || reason === 'window_removed';
  }
  if (classification === 'invalid') {
    return reason === 'malformed'
      || reason === 'unsupported_version'
      || reason === 'beach_removed';
  }
  return false;
}

function isOptionalAppVersion(
  value: unknown,
): boolean {
  return value === undefined
    || value === null
    || (
      typeof value === 'string'
      && BFR_APP_VERSION_PATTERN.test(value)
    );
}

function isOptionalCanonicalUuid(value: unknown): boolean {
  return value === undefined
    || value === null
    || (typeof value === 'string' && BFR_HANDOFF_ID_PATTERN.test(value));
}

function hasValidNativeChannelMetadata(
  metadata: Record<string, unknown>,
  expectedSource?: string,
): boolean {
  if (
    metadata.source !== undefined
    && metadata.source !== null
    && metadata.source !== expectedSource
  ) {
    return false;
  }
  if (
    metadata._platform !== undefined
    && (
      typeof metadata._platform !== 'string'
      || !BFR_NATIVE_PLATFORM_VALUES.has(metadata._platform)
    )
  ) {
    return false;
  }
  if (!isOptionalAppVersion(metadata.app_version)) return false;
  if (!isOptionalCanonicalUuid(metadata.expo_update_id)) return false;
  if (
    metadata.expo_channel !== undefined
    && metadata.expo_channel !== null
    && (
      typeof metadata.expo_channel !== 'string'
      || !BFR_EXPO_CHANNEL_VALUES.has(metadata.expo_channel)
    )
  ) {
    return false;
  }
  if (
    metadata.expo_runtime_version !== undefined
    && metadata.expo_runtime_version !== null
    && (
      typeof metadata.expo_runtime_version !== 'string'
      || !BFR_EXPO_RUNTIME_VERSION_PATTERN.test(metadata.expo_runtime_version)
    )
  ) {
    return false;
  }
  if (
    metadata.expo_is_embedded_launch !== undefined
    && metadata.expo_is_embedded_launch !== null
    && typeof metadata.expo_is_embedded_launch !== 'boolean'
  ) {
    return false;
  }
  if (
    metadata.expo_is_emergency_launch !== undefined
    && metadata.expo_is_emergency_launch !== null
    && typeof metadata.expo_is_emergency_launch !== 'boolean'
  ) {
    return false;
  }
  if (
    metadata.is_emulator !== undefined
    && typeof metadata.is_emulator !== 'boolean'
  ) {
    return false;
  }
  if (
    metadata.launch_primer_session_id !== undefined
    && (
      typeof metadata.launch_primer_session_id !== 'string'
      || !BFR_HANDOFF_ID_PATTERN.test(metadata.launch_primer_session_id)
    )
  ) {
    return false;
  }
  return true;
}

function buildBfrExactCallReceiptMetadata(
  eventType: string,
  metadata: unknown,
): Record<string, unknown> | null {
  if (!isRecord(metadata)) return null;
  const allowedKeys = eventType === BFR_EXACT_CALL_HANDOFF_EVENTS.started
    ? BFR_EXACT_CALL_LINK_OPENED_KEYS
    : BFR_EXACT_CALL_NATIVE_OPEN_KEYS;
  if (!hasOnlyKeys(metadata, allowedKeys)) return null;
  if (
    typeof metadata.handoff_id !== 'string'
    || !BFR_HANDOFF_ID_PATTERN.test(metadata.handoff_id)
    || metadata.source !== 'exact_call'
    || metadata.handoff_context !== 'exact_call'
  ) {
    return null;
  }
  if (
    metadata.surface !== undefined
    && (
      typeof metadata.surface !== 'string'
      || !BFR_PAGE_TYPES.includes(metadata.surface as BfrPageType)
    )
  ) {
    return null;
  }
  if (
    metadata.placement !== undefined
    && (
      typeof metadata.placement !== 'string'
      || !BFR_EXACT_CALL_PLACEMENT_VALUES.has(metadata.placement)
    )
  ) {
    return null;
  }

  if (eventType === BFR_EXACT_CALL_HANDOFF_EVENTS.nativeOpened) {
    return hasValidNativeChannelMetadata(metadata, 'exact_call')
      ? metadata
      : null;
  }
  return metadata;
}

function buildBfrHandoffResolutionMetadata(
  metadata: unknown,
): Record<string, unknown> | null {
  if (!isRecord(metadata) || !hasOnlyKeys(metadata, BFR_HANDOFF_RESOLUTION_KEYS)) {
    return null;
  }
  if (
    typeof metadata.handoff_id !== 'string'
    || !BFR_HANDOFF_ID_PATTERN.test(metadata.handoff_id)
    || !hasValidBfrHandoffResolutionPair(metadata)
    || !hasValidNativeChannelMetadata(metadata, 'launch-primer')
  ) {
    return null;
  }
  return metadata;
}

export function isBfrApiEventMetadata(
  eventType: unknown,
  metadata: unknown,
): boolean {
  if (typeof eventType !== 'string') return false;
  if (BFR_ONLY_EVENT_SET.has(eventType)) return true;
  if (!eventType.startsWith('app_handoff_') || !isRecord(metadata)) {
    return false;
  }

  return metadata.source === 'exact_call'
    || 'handoff_context' in metadata
    || 'fallback_classification' in metadata;
}

export function buildBfrApiEventMetadata(
  eventType: string,
  metadata: unknown,
): Record<string, unknown> | null {
  if (BFR_WEB_EVENT_TYPE_SET.has(eventType)) {
    return buildBfrWebEventMetadata(
      metadata as BfrWebEventMetadataMap[BfrWebEventType],
      eventType as BfrWebEventType,
    ) as Record<string, unknown> | null;
  }
  if (eventType === BFR_EXACT_CALL_HANDOFF_EVENTS.resolved) {
    return buildBfrHandoffResolutionMetadata(metadata);
  }
  if (BFR_EXACT_CALL_RECEIPT_EVENT_TYPES.has(eventType)) {
    return buildBfrExactCallReceiptMetadata(eventType, metadata);
  }
  return null;
}

export const VALID_EVENTS = [
  // Implicit preference learning events
  'beach_view',
  'discovery_click',
  'discovery_skip',
  'forecast_check',
  'location_update',
  // Engagement tracking events
  'page_view',
  'forecast_interaction',
  'session_action',
  'profile_update',
  'onboarding_step',
  'cta_click',
  // Review tracking events
  'review_form_open',
  'review_form_abandon',
  'review_validation_error',
  'review_submit',
  // Share tracking events
  'share_started',
  'share_completed',
  'share_link_opened',
  'share_link_copied',
  'share_image_saved',
  'share_sheet_blocked_pending',
  'cam_share',
  'share_intel_button_clicked',
  'share_intel_signin_prompt',
  'surf_plan_share',
  // Invite acquisition funnel events
  'invite_link_opened',
  'invite_open_app_clicked',
  'invite_app_store_clicked',
  'invite_continue_web_clicked',
  'invite_consumed',
  // Signup/auth conversion events
  'signup_cta_click',
  'signup_cta_view',
  'signin_cta_click',
  'signed_in',
  'auth_failed',
  // Auth funnel events (fire before user is authenticated)
  'auth_modal_opened',
  'auth_modal_closed_without_action',
  'auth_method_selected',
  'auth_provider_selected',
  'signup_started',
  'signup_success',
  'login_success',
  'login_failed',
  'signup_failed',
  'signup_form_submitted',
  'login_form_submitted',
  'native_app_first_open',
  'native_install_attribution_joined',
  // Home screen events
  'home_viewed',
  'home_at_beach_click',
  'home_plan_weekend_click',
  'home_plan_weekend_no_recommendation',
  'home_beach_forecast_viewed',
  'home_first_session_cta_tap',
  'home_hero_forecast_viewed',
  'home_locked_best_spot_teaser_tap',
  'home_map_tap',
  'home_menu_tap',
  'home_nearby_spot_tap',
  'home_notifications_tap',
  'home_search_tap',
  'home_set_alarm_tap',
  'home_surf_call_tap',
  'home_timeline_tap',
  // Session logging events
  'session_log_start',
  'session_log_draft_opened',
  'session_log_time_selected',
  'session_log_draft_progress',
  'session_log_submit',
  'session_created',
  'session_share_opened_post_save',
  'session_share_closed_post_save',
  // Onboarding/tour events
  'product_tour_started',
  'product_tour_completed',
  'product_tour_skipped',
  'product_tour_step_viewed',
  'onboarding_started',
  'onboarding_intro_get_started',
  'onboarding_step_viewed',
  'onboarding_step_completed',
  'onboarding_step_auto_skipped',
  'onboarding_video_started',
  'onboarding_video_completed',
  'onboarding_video_skipped',
  'onboarding_completed',
  'location_permission_granted',
  'location_permission_denied',
  // Beach detail events
  'beach_search',
  'forecast_tab_click',
  'horizon_strip_day_selected',
  'match_score_teaser_click',
  'match_score_teaser_view',
  'set_home_beach',
  'map_marker_click',
  // Intel events
  'local_intel_tab_viewed',
  'intel_post_created',
  'intel_post_confirmed',
  'plan_session_from_intel',
  // Profile events
  'surf_profile_viewed',
  'surf_profile_progress_shown',
  'learning_signal',
  'learning_progress_revealed',
  'learned_me_moment_viewed',
  // Discovery events
  'recommendation_impression',
  'personalized_score_shown',
  'favorite_shown_in_carousel',
  'mini_log_teaser_click',
  'plan_unlock_click',
  'discover_page_view',
  'discover_suggested_users_impression',
  'discover_profile_open',
  'discover_follow_attempt',
  // Social events
  'social_follow',
  'social_like',
  'social_invite_send',
  'social_invite_respond',
  'social_intel_confirm',
  // Tab and map engagement events
  'tab_view',
  'map_interaction',
  'map_marker_tapped',
  'map_viewed',
  // Map engagement
  'map_ready',
  'map_load_failed',
  // Forecast reliability
  'forecast_ready',
  // Session Intelligence measurement events
  'surf_window_impression',
  'surf_window_click',
  'why_this_call_opened',
  'app_deeplink_clicked',
  // Native deeplink/session handoff events
  'deeplink_received',
  'spot_resolve',
  'session_prefill_shown',
  'session_silent_submit',
  'forecast_accuracy_table_viewed',
  'save_alert_clicked',
  'seo_intent_page_window_clicked',
  // Free growth education + watched spot funnel
  'free_growth_education_impression',
  'free_growth_education_cta_tapped',
  'watch_spot_tapped',
  'alert_rule_created',
  // Session log funnel
  'session_log_beach_selected',
  'session_log_conditions_set',
  'session_log_form_view',
  'session_log_rating_set',
  'session_log_photo_added',
  'session_photo_upload_started',
  'session_photo_upload_succeeded',
  'session_photo_upload_failed',
  'session_log_abandon',
  'session_log_validation_failed',
  'session_spot_search_no_results',
  'session_custom_spot_cta_tapped',
  'session_custom_spot_returned',
  // Phase 21 native board management events
  'board_form_saved',
  'session_board_fit_feedback_selected',
  // Phase 22 native forecast-visual and custom-spot funnel events.
  // These are written directly to user_events by native clients. The DB
  // CHECK constraint must include these names (see migration
  // 20260609120000_add_phase22_native_analytics_events.sql).
  'custom_spot_save_confirmation_viewed',
  'custom_spot_forecast_source_viewed',
  'forecast_visual_layer_selected',
  'synced_forecast_time_selected',
  // Search
  'beach_search_result_click',
  // Growth markers
  'acquisition_source_self_reported',
  'apple_orphan_precheck_indeterminate',
  'apple_orphan_prevented',
  'apple_orphan_recovery_flagged',
  'first_beach_view_post_signup',
  'first_session_logged',
  // Empty states & impressions
  'empty_state_shown',
  'cta_impression',
  // Reliability
  'client_error',
  // Engagement depth (anon + auth)
  'scroll_depth',
  'time_on_page',
  // Phase 2 match-feature events (authenticated only)
  'match_card_rendered',
  'match_strip_tap',
  'for_you_tap',
  'unlock_toast_shown',
  'session_decomposition_selected',
  'match_alert_toggle',
  // Roadmap events
  'feedback_roadmap_opened',
  'feedback_roadmap_request_created',
  'feedback_roadmap_viewed',
  'feedback_roadmap_vote_submitted',
  'roadmap_vote_cast',
  'roadmap_item_submitted',
  'roadmap_item_status_changed',
  'custom_spots_feedback_viewed',
  'custom_spots_feedback_voted',
  'missing_spot_prompt_viewed',
  'missing_spot_prompt_tapped',
  'custom_spot_create_started',
  'custom_spot_saved',
  'custom_spot_failed',
  // Anon alert capture funnel (3 pre-auth + 2 post-auth). Pre-auth events
  // are also added to ANONYMOUS_ALLOWED_EVENTS and PRE_AUTH_ONLY_EVENTS;
  // the post-auth events fire only from /auth/callback once the session
  // exists, so they belong to the authed flow only.
  'anon_alert_capture_view',
  'anon_alert_capture_submit',
  'anon_alert_capture_error',
  'anon_alert_magic_link_clicked',
  'anon_alert_signup_success',
  // Paywall + trial funnel (native, added 2026-05-02 — fires from
  // trial-prompt onboarding step and standalone paywall screen)
  'paywall_opened',
  'paywall_dismissed',
  'paywall_purchase_started',
  'paywall_purchase_success',
  'paywall_purchase_failed',
  'paywall_ready',
  'paywall_plan_selected',
  'paywall_cadence_selected',
  'paywall_restore_started',
  'paywall_restore_success',
  'paywall_restore_failed',
  'paywall_trial_cta_tapped',
  'paywall_lifetime_cta_tapped',
  'paywall_soft_prompt_shown',
  'founder_100_popup_viewed',
  'founder_100_popup_cta_tapped',
  'founder_100_popup_dismissed',
  'onboarding_paywall_skipped',
  'onboarding_trial_started',
  'trial_active',
  'trial_entitlement_received',
  // Push registration observability (native)
  'push_permission_denied',
  'push_token_fetch_failed',
  'push_device_registration_failed',
  'push_device_registered',
  // Apple sign-in beta prompt funnel
  'apple_beta_prompt_eligible',
  'apple_beta_prompt_viewed',
  'apple_beta_prompt_qr_rendered',
  'apple_beta_prompt_open_testflight_clicked',
  'apple_beta_prompt_copy_link_clicked',
  'apple_beta_prompt_dismissed',
  // App-first landing handoff funnel (web -> native)
  'app_handoff_view',
  'app_handoff_qr_rendered',
  'app_handoff_email_submit',
  'app_handoff_email_sent',
  'app_handoff_email_failed',
  'app_handoff_link_opened',
  'app_handoff_native_open',
  'watched_call_context_resolved',
  // Android beta lead capture (public waitlist form with anonymous session id)
  'android_lead_captured',
  // Durable beach-follow and return-loop measurement. Exact-call handoff
  // reuses app_handoff_link_opened/app_handoff_native_open with bounded context.
  ...BFR_WEB_EVENT_TYPES,
] as const;

export type EventType = (typeof VALID_EVENTS)[number];

export const EXTERNAL_ANALYTICS_ONLY_EVENTS = [
  'android_install_cta_click',
  'android_waitlist_cta_click',
  'android_waitlist_cta_view',
  'auth_redirect_completed',
  'auth_wall_dismissed',
  'auth_wall_shown',
  'forecast_alerts_enabled',
  'install_pwa',
  'invite_friend_clicked',
  'ios_app_cta_click',
  'ios_app_cta_view',
  'iphone_app_banner_click',
  'iphone_app_banner_dismiss',
  'login_started',
  'magic_link_clicked',
  'magic_link_sent',
  'post_beach_intel',
  'public_page_view',
  'quick_log_expanded',
  'referral_code_failed',
  'referral_code_generated',
  'set_alarm_clicked',
  'share_session_clicked',
  'share_sheet_opened',
  'user_signed_in',
] as const;

/**
 * Current literals posted to /api/events that are not accepted by VALID_EVENTS.
 * This preserves behavior for the registry refactor; follow-up slices should
 * either migrate these callers to existing event names or explicitly add them.
 */
export const KNOWN_REJECTED_USER_EVENT_EMITTERS = [
] as const;

/**
 * Event types present in the user_events CHECK constraint but deliberately
 * absent from VALID_EVENTS.
 *
 * Native `trackEvent()` inserts straight into user_events via the Supabase
 * client, so these never transit /api/events and must not widen that route's
 * allowlist. They are still required in the DB CHECK — before migration
 * 20260812130000 every insert of one raised 23514 and was silently dropped,
 * because `trackEvent` is void-dispatched and nothing surfaced the loss.
 *
 * Adding a native-only event means adding it here AND to a CHECK migration.
 * The sync test fails if a CHECK entry appears in none of the three lists.
 */
export const NATIVE_DIRECT_INSERT_EVENTS = [
  'onboarding_paywall_viewed',
  'onboarding_free_selected',
  'onboarding_purchase_started',
  'onboarding_purchase_success',
  'onboarding_purchase_failed',
  'onboarding_purchase_cancelled',
  'onboarding_restore_result',
  'community_filter_selected',
  'siri_shortcut_opened',
  'garmin_connect_viewed',
  'garmin_designated_activity_set',
  'watched_call_exposed',
  'watched_call_created',
  'watched_call_already_exists',
  'watched_call_update_eligible',
  'watched_call_update_suppressed',
  'watched_call_update_delivered',
  'watched_call_update_opened',
  'watched_call_manual_reopened',
  'home_mode_restored',
  'home_mode_expired',
  'home_recommendation_changed',
] as const;

export const ANONYMOUS_ALLOWED_EVENTS: readonly EventType[] = [
  'page_view', 'beach_view', 'tab_view', 'onboarding_step',
  // Conversion tracking (critical for understanding anon→authed funnel)
  'signup_cta_click', 'signup_cta_view', 'signin_cta_click', 'cta_click',
  // Auth funnel events (fire before user is authenticated — must be anonymous-allowed)
  'auth_modal_opened', 'auth_modal_closed_without_action',
  'auth_method_selected', 'auth_provider_selected',
  'auth_failed', 'native_app_first_open',
  'apple_orphan_precheck_indeterminate', 'apple_orphan_prevented',
  // Auth-transition events — legitimately fire for both anon and authed users
  // (e.g. signup success fires after auth completes). Not on PRE_AUTH_ONLY_EVENTS.
  'signup_started', 'signup_success', 'login_success',
  // Form-submitted events — pre-auth only; the form can only be submitted by
  // an anonymous user. Authed fires are ghost-triggers and dropped server-side
  // via PRE_AUTH_ONLY_EVENTS.
  'signup_form_submitted', 'login_form_submitted', 'login_failed', 'signup_failed',
  // Native signed-out onboarding intro CTA.
  'onboarding_intro_get_started',
  // Engagement signals from anonymous visitors
  'forecast_interaction', 'forecast_tab_click', 'horizon_strip_day_selected',
  'beach_search', 'beach_search_result_click', 'map_interaction', 'map_marker_click',
  'share_started', 'share_completed', 'share_link_opened', 'share_link_copied',
  'cam_share',
  'invite_link_opened', 'invite_open_app_clicked', 'invite_app_store_clicked',
  'invite_continue_web_clicked',
  'match_score_teaser_view', 'match_score_teaser_click',
  // Map reliability (anon visitors hit the map immediately)
  'map_ready', 'map_load_failed',
  // Forecast reliability
  'forecast_ready',
  // Session Intelligence public measurement
  'surf_window_impression',
  'surf_window_click',
  'why_this_call_opened',
  'app_deeplink_clicked',
  'forecast_accuracy_table_viewed',
  'save_alert_clicked',
  'seo_intent_page_window_clicked',
  'free_growth_education_impression',
  'free_growth_education_cta_tapped',
  // Empty states + CTA impressions
  'empty_state_shown', 'cta_impression',
  // Client error capture
  'client_error',
  // Engagement depth
  'scroll_depth', 'time_on_page',
  // Anon alert capture (pre-auth only — fired from anonymous SEO landings).
  // The two post-auth siblings (anon_alert_magic_link_clicked,
  // anon_alert_signup_success) deliberately omitted; they fire only once
  // the user is authenticated in /auth/callback.
  'anon_alert_capture_view',
  'anon_alert_capture_submit',
  'anon_alert_capture_error',
  // App-first landing handoff funnel - fire for signed-out landing visitors.
  'app_handoff_view', 'app_handoff_qr_rendered', 'app_handoff_email_submit',
  'app_handoff_email_sent', 'app_handoff_email_failed', 'app_handoff_link_opened',
  'app_handoff_native_open',
  'watched_call_context_resolved',
  // Android beta lead capture can be submitted before authentication.
  'android_lead_captured',
  ...BFR_ANONYMOUS_EVENT_TYPES,
] as const;

/**
 * Pre-auth funnel events should not be recorded for authenticated users.
 * These events are only meaningful when tracking anon → authed conversion.
 * Exported so tests can verify the invariant alongside VALID_EVENTS.
 */
export const PRE_AUTH_ONLY_EVENTS: readonly EventType[] = [
  'signup_cta_view',
  'signup_cta_click',
  'signin_cta_click',
  'signup_form_submitted',
  'login_form_submitted',
  'login_failed',
  'signup_failed',
  'auth_modal_opened',
  'auth_modal_closed_without_action',
  'auth_failed',
  'native_app_first_open',
  'apple_orphan_precheck_indeterminate',
  'apple_orphan_prevented',
  // Native signed-out onboarding intro CTA.
  'onboarding_intro_get_started',
  // Anon alert capture (pre-auth only). Ghost-authed fires of these
  // events are silently dropped server-side. The post-auth siblings
  // (magic_link_clicked, signup_success) intentionally NOT here — they
  // require an authenticated user.
  'anon_alert_capture_view',
  'anon_alert_capture_submit',
  'anon_alert_capture_error',
] as const;
