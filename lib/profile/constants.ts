/**
 * Profile Field Selection Constants
 *
 * Centralized field lists for profile API queries.
 * Ensures consistency across endpoints and simplifies maintenance.
 *
 * @see /app/api/profile/[id]/route.ts
 * @see /app/api/profile/route.ts
 */

/** Core profile fields - always included in profile responses */
export const PROFILE_CORE_FIELDS = [
  'followers_count',
  'following_count',
  'created_at',
  'avatar_url',
  'email',
  'bio',
  'location',
  'experience_level',
  'instagram',
  'onboarding_completed_at',
] as const;

/** Surf preference fields */
export const PROFILE_PREFERENCE_FIELDS = [
  'surf_styles',
] as const;

/** Notification preference fields */
export const PROFILE_NOTIFICATION_FIELDS = [
  'notif_push_enabled',
  'notif_forecast_alerts',
  'notif_email_enabled',
  'notif_inapp_enabled',
  'notif_likes',
  'notif_follows',
  'notif_reminders',
  'notif_xp_updates',
] as const;

/**
 * Every profile column currently readable through the public profile surface.
 * Analytics consent is intentionally absent and is available only through the
 * owner-scoped get_my_analytics_tracking_allowed RPC.
 */
export const PROFILE_PUBLIC_FIELDS = [
  'activity_level',
  'analytics_exclusion_reason',
  'analytics_is_real_user',
  'avatar_url',
  'bio',
  'created_at',
  'crowd_tolerance',
  'deleted_at',
  'digest_session_invites',
  'display_name',
  'email',
  'email_session_invites',
  'experience_level',
  'followers_count',
  'following_count',
  'full_name',
  'home_beach_id',
  'home_region',
  'id',
  'inapp_session_invites',
  'instagram',
  'is_admin',
  'is_mock',
  'is_system_account',
  'location',
  'max_drive_minutes',
  'notif_email_enabled',
  'notif_follows',
  'notif_forecast_alerts',
  'notif_inapp_enabled',
  'notif_likes',
  'notif_push_enabled',
  'notif_reminders',
  'notif_session_invites',
  'notif_similarity_alerts',
  'notif_water_quality',
  'notif_xp_updates',
  'onboarding_completed_at',
  'paywall_soft_prompt_shown',
  'personality_type',
  'phone_number',
  'posting_window',
  'preferences_v2_shown_at',
  'preferred_session_time',
  'preferred_wave_size',
  'referral_code',
  'signup_context',
  'signup_location',
  'sound_effects_enabled',
  'surf_styles',
  'tide_comfort',
  'timezone',
  'trust_score',
  'updated_at',
  'wind_comfort',
] as const;

export const PROFILE_PUBLIC_SELECT = PROFILE_PUBLIC_FIELDS.join(',');

export const PROFILE_PUBLIC_WITH_HOME_BEACH_SELECT = [
  PROFILE_PUBLIC_SELECT,
  'home_beach:beaches!profiles_home_beach_id_fkey(*)',
].join(',');

export const PROFILE_PUBLIC_SESSION_RELATION_SELECT =
  'user:profiles(id,full_name,avatar_url)' as const;

/** Complete SELECT string for profile queries with home beach join */
export const PROFILE_FULL_SELECT = [
  ...PROFILE_CORE_FIELDS,
  ...PROFILE_PREFERENCE_FIELDS,
  ...PROFILE_NOTIFICATION_FIELDS,
  'home_beach:beaches!profiles_home_beach_id_fkey(id, name)',
].join(',\n        ');

/** Minimal SELECT for onboarding status check only */
export const PROFILE_ONBOARDING_SELECT = 'onboarding_completed_at';
