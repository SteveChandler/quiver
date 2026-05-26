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

/** Android launch waitlist state */
export const PROFILE_ANDROID_WAITLIST_FIELDS = [
  'wants_android_access',
  'android_waitlist_joined_at',
  'android_waitlist_source',
  'android_waitlist_surface',
  'android_waitlist_placement',
] as const;

/** Complete SELECT string for profile queries with home beach join */
export const PROFILE_FULL_SELECT = [
  ...PROFILE_CORE_FIELDS,
  ...PROFILE_PREFERENCE_FIELDS,
  ...PROFILE_NOTIFICATION_FIELDS,
  ...PROFILE_ANDROID_WAITLIST_FIELDS,
  'home_beach:beaches!profiles_home_beach_id_fkey(id, name)',
].join(',\n        ');

/** Minimal SELECT for onboarding status check only */
export const PROFILE_ONBOARDING_SELECT = 'onboarding_completed_at';
