// This file imports from the auto-generated database.generated.ts
// and exports convenience type aliases for common usage patterns

import type { Database, Json } from './database.generated'
import type { EnhancedForecastEntity as ForecastEnhancedForecastEntity } from './forecast'

// Re-export the full Database type and JSON type
export type { Database, Json }

// ===================================================
// TABLE ROW TYPES - Direct database table types
// ===================================================

export type Beach = Database['public']['Tables']['beaches']['Row']
export type BeachInsert = Database['public']['Tables']['beaches']['Insert']
export type BeachUpdate = Database['public']['Tables']['beaches']['Update']

/** Lightweight beach summary for lists, search results, and cards */
export type BeachSummary = Pick<Beach, 'id' | 'name' | 'slug' | 'city' | 'state' | 'country' | 'lat' | 'lon'>

/** Beach data needed for map pins */
export type BeachMapItem = Pick<Beach, 'id' | 'name' | 'slug' | 'lat' | 'lon' | 'skill_level'>

/** Minimal beach info for pickers and dropdowns (no coordinates) */
export type BeachBasicInfo = Pick<Beach, 'id' | 'name' | 'city' | 'state' | 'country'>

export type BeachReview = Database['public']['Tables']['beach_reviews']['Row']
export type BeachReviewInsert = Database['public']['Tables']['beach_reviews']['Insert']
export type BeachReviewUpdate = Database['public']['Tables']['beach_reviews']['Update']

export type Session = Database['public']['Tables']['sessions']['Row']
export type SessionInsert = Database['public']['Tables']['sessions']['Insert']
export type SessionUpdate = Database['public']['Tables']['sessions']['Update']

export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type IntelPost = Database['public']['Tables']['intel_posts']['Row']
export type IntelPostInsert = Database['public']['Tables']['intel_posts']['Insert']
export type IntelPostUpdate = Database['public']['Tables']['intel_posts']['Update']
export type IntelPostTag = Database['public']['Enums']['intel_post_tag']

/**
 * Emoji rating options for intel posts
 * fire = excellent conditions
 * shaka = good conditions
 * meh = average conditions
 * thumbsdown = poor conditions
 */
export type IntelEmojiRating = 'fire' | 'shaka' | 'meh' | 'thumbsdown';

// Note: intel_reports table not yet in schema - uncomment when migration 20260113145000 is applied
// export type IntelReport = Database['public']['Tables']['intel_reports']['Row']
// export type IntelReportInsert = Database['public']['Tables']['intel_reports']['Insert']

// Temporary manual type definition until migration is applied
export interface IntelReport {
  id: string;
  intel_post_id: string;
  user_id: string;
  reason: string | null;
  created_at: string;
}

export interface IntelReportInsert {
  intel_post_id: string;
  user_id: string;
  reason?: string | null;
}

// Note: follows table not yet in schema - uncomment when migration is applied
// export type Follow = Database['public']['Tables']['follows']['Row']
// export type FollowInsert = Database['public']['Tables']['follows']['Insert']

export type SessionShare = Database['public']['Tables']['session_shares']['Row']
export type SessionShareInsert = Database['public']['Tables']['session_shares']['Insert']

export type Board = Database['public']['Tables']['boards']['Row']
export type BoardInsert = Database['public']['Tables']['boards']['Insert']
export type BoardUpdate = Database['public']['Tables']['boards']['Update']

export type BeachPhoto = Database['public']['Tables']['beach_photos']['Row']
export type BeachPhotoInsert = Database['public']['Tables']['beach_photos']['Insert']
export type BeachPhotoUpdate = Database['public']['Tables']['beach_photos']['Update']

export type SessionForecastSnapshot = Database['public']['Tables']['session_forecast_snapshots']['Row']
export type SessionForecastSnapshotInsert = Database['public']['Tables']['session_forecast_snapshots']['Insert']

export type BeachForecastAccuracy = Database['public']['Tables']['beach_forecast_accuracy']['Row']
export type BeachForecastAccuracyInsert = Database['public']['Tables']['beach_forecast_accuracy']['Insert']
export type BeachForecastAccuracyUpdate = Database['public']['Tables']['beach_forecast_accuracy']['Update']

export type BeachRecommendationCalibration = Database['public']['Tables']['beach_recommendation_calibration']['Row']
export type BeachRecommendationCalibrationInsert = Database['public']['Tables']['beach_recommendation_calibration']['Insert']
export type BeachRecommendationCalibrationUpdate = Database['public']['Tables']['beach_recommendation_calibration']['Update']

export type SessionMedia = Database['public']['Tables']['session_media']['Row']
export type SessionMediaInsert = Database['public']['Tables']['session_media']['Insert']
export type SessionMediaUpdate = Database['public']['Tables']['session_media']['Update']

// ===================================================
// EXTENDED TYPES - Types with relationships/joins
// ===================================================

// Subset of beach_photos columns commonly used in queries
export type BeachPhotoSelect = Pick<BeachPhoto, 'beach_id' | 'thumb_url' | 'image_url'>

// Featured beach photo (from beach_photos_featured view)
export interface BeachPhotoFeatured {
  beach_id: string
  image_url: string
  deleted_at: string | null
}

export interface BeachReviewWithUser extends BeachReview {
  profiles: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

// User profile subset for session relationships
export interface SessionUserProfile {
  id: string
  full_name: string | null
  avatar_url: string | null
}

/**
 * Forecast snapshot data from session_forecast_snapshots table
 * Returned when querying session with forecast comparison data
 */
export interface SessionForecastSnapshotData {
  forecast_snapshot: Json
  actual_conditions: Json
  forecast_vs_actual: Json | null
  forecast_confidence_score: number | null
  data_source: string | null
}

export interface SessionWithDetails extends Session {
  // Canonical names (match Supabase relation naming)
  beaches: Beach | null
  boards: Board | null
  profiles: SessionUserProfile | null

  /**
   * Back-compat fields used across UI/components.
   *
   * Note: `sessions` table no longer has a dedicated `session_date` column; most queries
   * alias `arrival_time` → `session_date` for older components/tests.
   */
  session_date?: string | null

  /**
   * Enriched at read-time (see actions/session-actions.ts addFeaturedPhotoToSessions).
   * Not a physical column on `sessions`.
   */
  featured_photo_url?: string | null

  /**
   * Forecast snapshot data from session_forecast_snapshots table.
   * Contains forecast conditions at time of session, actual conditions reported,
   * and diff between forecast vs actual for fields that were changed.
   */
  forecast_snapshot?: SessionForecastSnapshotData | null

  // Aliases for backward compatibility with existing code
  // These are optional since queries may return either naming convention
  beach?: Beach | null
  board?: Board | null
  user?: SessionUserProfile | null
}

export interface BeachWithReviews extends Beach {
  reviews: BeachReview[]
  // Note: review_count and average_rating already exist in Beach type
}

export interface ProfileWithStats extends Profile {
  // Note: session_count, follower_count, following_count already exist in Profile type
}

export interface IntelPostWithUser extends IntelPost {
  // session_id now comes from the generated IntelPost (migration 20260811020600);
  // re-declaring it as optional here conflicts with the required base property.
  video_media_id?: string | null
  // Additional fields from RPC function get_nearby_intel_posts
  beach_name?: string
  distance_miles?: number
  user_name?: string

  // User profile information (enriched from profiles table)
  user?: {
    id?: string
    full_name: string
    avatar_url: string | null
    is_system_account?: boolean | null
  }

  // Legacy field for backward compatibility
  profiles?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null

  // User confirmation status (legacy, computed from user_vote_type for backward compat)
  user_has_confirmed?: boolean

  // Voting system fields (from intel_votes table)
  user_vote_type?: 'helpful' | 'off' | 'confirmed' | null
  rank_score?: number
}

// ===================================================
// RPC FUNCTION RETURN TYPES
// ===================================================

// Best times window recommendation (from get_best_times RPC)
export type GetBestTimesRow = Database['public']['Functions']['get_best_times']['Returns'][0]

// ===================================================
// FORECAST TYPES
// ===================================================

// Alias for enhanced forecast row (backward compatibility)
export type Forecast = Database['public']['Tables']['enhanced_forecasts']['Row']

/**
 * Backward-compatible forecast types.
 *
 * These are used widely in older components/tests and intentionally live in `types/database.ts`
 * as convenience re-exports, even though the canonical definition lives in `types/forecast.ts`.
 */
export type EnhancedForecastEntity = ForecastEnhancedForecastEntity

/**
 * Legacy "enhanced forecast" shape used across tests and UI.
 *
 * We keep this permissive because the app has accumulated multiple forecast shapes (domain vs DB vs view-model).
 * The index signature (via intersection) prevents excess-property errors in test factories.
 */
export type EnhancedForecast = EnhancedForecastEntity & Record<string, unknown>

/**
 * Journal/analytics convenience types (used by journal components and test mocks).
 * Keep these minimal and evolve as features solidify.
 */
export type CalendarHeatmapData = {
  date: string
  count: number
  sessions?: string[]
}

export type SessionAnalytics = {
  totalSessions: number
  totalHours?: number
  averageRating?: number
}

export type JournalViewMode = 'calendar' | 'list'

export type JournalDisplayOptions = {
  showRatings?: boolean
  showPhotos?: boolean
}

// ===================================================
// USER ACTIVITY / ACTIVITY FEED TYPES
// ===================================================

// Base user activity row from database
export type UserActivity = Database['public']['Tables']['user_activities']['Row']

// Activity feed item with enriched user profile data
export interface ActivityFeedItem {
  id: string
  user_id: string
  activity_type: string
  entity_type: string
  entity_id: string
  metadata: Json | null
  created_at: string
  // Enriched fields from profile join
  user_name: string | null
  user_avatar: string | null
}

// ===================================================
// JOURNAL EXPORT TYPES
// ===================================================

export interface ExportOptions {
  type: 'monthly' | 'yearly' | 'single'
  format: 'pdf' | 'html' | 'json'
  month?: string
  year?: string
  sessionIds?: string[]
  includeAnalytics?: boolean
  includePhotos?: boolean
}

export interface ExportResult {
  filename: string
  downloadUrl: string
  generatedAt: string
  expiresAt: string
}

// ===================================================
// CHECK-IN TYPES (legacy table, may be migrated to condition_reports)
// ===================================================

// Base check-in row
export interface CheckIn {
  id: string
  beach_id: string
  user_id: string
  checked_in_at: string
  wave_height: number | null
  wind_speed: number | null
  wind_direction: string | null
  water_temp: number | null
  crowd_level: number | null
  vibe: string | null
  forecast_accuracy_rating: 'accurate' | 'somewhat' | 'inaccurate' | null
  created_at?: string
  // Optional beach relation
  beaches?: {
    name: string
    location_text?: string
  } | null
}

// Check-in with user profile data
export interface CheckInWithUser extends CheckIn {
  user: {
    username: string | null
    profile_picture_url: string | null
  }
  profiles?: {
    username: string | null
    profile_picture_url: string | null
  } | null
}

// Forecast accuracy statistics (from RPC function)
export interface ForecastAccuracyStats {
  total_reports: number
  accurate_count: number
  somewhat_count: number
  inaccurate_count: number
  accuracy_percentage: number
}

// ===================================================
// RE-EXPORT EVERYTHING FROM GENERATED FILE
// ===================================================

export * from './database.generated'
