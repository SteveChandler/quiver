export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  experience_level: string | null;
  instagram: string | null;
  home_beach_id: string | null;
  notification_session_reminders: boolean;
  notification_community_replies: boolean;
  inapp_session_invites?: boolean; // added by migration
  email_session_invites?: boolean; // added by migration
  digest_session_invites?: boolean; // added by migration
  followers_count: number;
  following_count: number;
  is_mock: boolean; // added by migration - flag for mock/test users
  created_at: string;
  updated_at: string;
};

export type Beach = {
  id: string;
  name: string;
  location?: any; // PostGIS POINT type (legacy)
  location_text?: string; // Human readable location
  latitude: number;
  longitude: number;
  description?: string;
  wave_quality_rating?: number;
  crowd_density_rating?: number;
  parking_rating?: number;
  accessibility_rating?: number;
  // Preferences and metadata (nullable)
  break_type?: string | null;
  shoreline_aspect_deg?: number | null;
  swell_window_min_deg?: number | null;
  swell_window_max_deg?: number | null;
  wind_offshore_deg?: number | null;
  wind_offshore_tol_deg?: number | null;
  wind_cross_shore_ok_kt?: number | null;
  wind_onshore_bad_kt?: number | null;
  preferred_tide_ft_min?: number | null;
  preferred_tide_ft_max?: number | null;
  skill_level?: string | null;
  best_swell_cardinals?: string[] | null;
  best_wind_cardinals?: string[] | null;
  preference_model?: Record<string, any> | null;
  // Station overrides (optional)
  cdip_station?: string | null;
  ndbc_station?: string | null;
  created_at: string;
  updated_at: string;
};

export type FavoriteBeach = {
  id: string;
  user_id: string;
  beach_id: string;
  rank?: number | null;
  created_at: string;
};

export type Board = {
  id: string;
  user_id: string;
  name: string;
  board_type?: string;
  type?: string;
  dimensions?: string;
  length?: number;
  width?: number;
  thickness?: number;
  volume?: number;
  size?: string;
  brand?: string;
  model?: string;
  description?: string;
  image_url?: string | null;
  session_count?: number;
  created_at: string;
  updated_at: string;
};

export type SessionStatus = "planned" | "completed" | "cancelled";

export type Session = {
  id: string;
  /**
   * The owning user's ID - matches the actual database schema
   */
  user_id: string;
  /**
   * The profile ID - required by the database schema
   */
  profile_id: string;
  beach_id?: string;
  board_id?: string;
  beach_name?: string;
  status: SessionStatus;
  /**
   * Combined timestamp for date and (optional) start time of the surf session.
   * This replaces the previous `session_date` / `start_time` pair.
   */
  arrival_time: string;
  /**
   * Deprecated – retained temporarily while UI migrates to `arrival_time`.
   */
  session_date?: string;
  /**
   * Optional explicit start and finish times retained for UI compatibility. They may not exist in the DB schema but
   * several parts of the codebase still reference them when preparing `arrival_time`.
   */
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  goals?: string[]; // text[]
  notes?: string;
  invitee_ids?: string[]; // uuid[]
  // Additional fields that might be used
  wave_quality?: number;
  wave_height?: string;
  water_temp?: string;
  crowd_level?: number;
  crowd_rating?: number;
  parking_ease?: number;
  is_public?: boolean;
  /**
   * Optional UI-centric columns now persisted in the DB
   */
  rating?: number;
  description?: string;
  image_url?: string | null;
  likes_count?: number;
  comments_count?: number;
  created_at: string;
  updated_at: string;
};

export type SessionMedia = {
  id: string;
  session_id: string;
  storage_path: string;
  media_type: "image" | "video";
  created_at: string;
};

export type Comment = {
  id: string;
  session_id: string;
  parent_comment: string | null;
  user_id: string;
  content: string;
  created_at: string;
};

export type SessionLike = {
  id: string;
  session_id: string;
  user_id: string;
  created_at: string;
};

export type UserFollow = {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
};

export type UserActivity = {
  id: string;
  user_id: string;
  activity_type: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, any>;
  created_at: string;
};

export type ActivityFeedItem = UserActivity & {
  user_name: string | null;
  user_avatar: string | null;
};

export type Forecast = {
  id: string;
  beach_id: string;
  forecast_date: string;
  forecast_time: string;
  wave_height: string;
  water_temp: string;
  wind_speed: string;
  wind_direction: string | null;
  tide: string | null;
  weather_condition: string | null;
  created_at: string;
  updated_at: string;
};

export type BeachWithForecasts = Beach & {
  forecasts: Forecast[];
};

export type SessionWithDetails = Session & {
  beach: Beach;
  board: Board | null;
  user: Profile;
  // Optional fields used by the UI but not strictly part of the core Session schema
  rating?: number;
  description?: string;
  image_url?: string;
  likes_count?: number;
  comments_count?: number;
};

export type BeachReview = {
  id: string;
  beach_id: string;
  user_id: string;
  overall_rating: number; // 1-5 stars
  wave_quality_rating: number; // 1-5 stars
  crowd_density_rating: number; // 1-5 stars
  parking_rating: number; // 1-5 stars
  accessibility_rating: number; // 1-5 stars
  title: string;
  content: string;
  visit_date?: string; // When they visited the beach
  created_at: string;
  updated_at: string;
};

export type BeachReviewWithUser = BeachReview & {
  user: {
    full_name: string;
    avatar_url: string | null;
    email: string | null;
  };
};

export type BeachRecommendationCalibration = {
  id: string;
  beach_id: string;
  window_start: string; // date
  window_end: string; // date
  samples_count: number;
  best_swell_dir_deg_min: number | null;
  best_swell_dir_deg_max: number | null;
  best_wind_offshore_deg: number | null;
  best_wind_tol_deg: number | null;
  best_tide_ft_min: number | null;
  best_tide_ft_max: number | null;
  skill_level_inferred?: string | null;
  method: string; // 'default_seed' | 'user_calibrated' | 'noaa_historical'
  metrics?: Record<string, any> | null;
  updated_at: string;
};

// Analytics types for Surf Journal+
export type SessionAnalytics = {
  type?: string;
  userId: string;
  totalSessions: number;
  completedSessions: number;
  totalHours: number;
  averageRating: number;
  averageWaveHeight: number;
  favoriteBeach: string | null;
  frequentBoards: Array<{
    boardId: string;
    boardName: string;
    usageCount: number;
  }>;
  monthlyStats: Array<{
    month: string;
    sessionCount: number;
    averageRating: number;
    totalHours: number;
  }>;
  waveHeightTrend: Array<{
    date: string;
    averageWaveHeight: number;
    sessionCount: number;
  }>;
  conditionRatings: {
    waterTemp: number;
    crowdLevel: number;
    windConditions: number;
    waveQuality: number;
    parkingEase: number;
  };
  generatedAt: string;
};

export type CalendarHeatmapData = {
  date: string;
  sessionCount: number;
  averageWaveHeight: number;
  averageRating: number;
  sessions: Array<{
    id: string;
    beachName: string;
    rating: number;
    waveHeight: number;
  }>;
};

export type JournalViewMode = "list" | "calendar";

export type JournalDisplayOptions = {
  viewMode: JournalViewMode;
  showPrivate: boolean;
  filterByBeach?: string;
  filterByBoard?: string;
  dateRange?: {
    start: string;
    end: string;
  };
};

export type SessionAnnotation = {
  id: string;
  sessionId: string;
  userId: string;
  notes: string;
  isPrivate: boolean;
  photos: string[];
  createdAt: string;
  updatedAt: string;
};

export type ExportOptions = {
  type: "single" | "monthly" | "yearly";
  sessionIds?: string[];
  month?: string;
  year?: string;
  includePhotos: boolean;
  includeAnalytics: boolean;
  format: "pdf";
};

export type ExportResult = {
  filename: string;
  downloadUrl: string;
  generatedAt: string;
  expiresAt: string;
};

// Intel post types for Local Intel Club feature
export type IntelPostTag =
  | "parking"
  | "hazard"
  | "crowd"
  | "conditions"
  | "access"
  | "other";

export type IntelPost = {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  tag: IntelPostTag;
  title: string;
  description: string;
  photo_url?: string | null;
  photo_storage_path?: string | null;
  confirmations_count: number;
  is_active: boolean;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
  // Surf condition fields
  wave_height?: number | null;
  wind_speed?: number | null;
  wind_direction?: string | null;
  water_temp?: number | null;
  crowd_level?: number | null;
  wave_types?: string[] | null;
  forecast_accuracy?: "accurate" | "somewhat" | "inaccurate" | null;
};

export type IntelPostConfirmation = {
  id: string;
  intel_post_id: string;
  user_id: string;
  created_at: string;
};

export type IntelPostWithUser = IntelPost & {
  user: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  user_confirmed?: boolean; // Whether the current user has confirmed this post
};

// Check-ins Types for Community Surf Condition Reports
export type CheckIn = {
  id: string;
  user_id: string;
  beach_id: string;
  checked_in_at: string;
  // Surf conditions
  wave_height: number | null; // feet
  wind_speed: number | null; // mph
  wind_direction: string | null; // N, NE, E, SE, S, SW, W, NW, OFFSHORE, ONSHORE, CROSS
  water_temp: number | null; // fahrenheit
  // Community data
  crowd_level: number | null; // 1-5 scale (1=empty, 5=packed)
  vibe: string | null; // Free text notes
  // Forecast accuracy rating
  forecast_accuracy_rating: "accurate" | "somewhat" | "inaccurate";
  // Metadata
  created_at: string;
  updated_at: string;
};

export type CheckInWithUser = CheckIn & {
  user: {
    username: string | null;
    profile_picture_url: string | null;
  };
};

export type ForecastAccuracyStats = {
  total_reports: number;
  accurate_count: number;
  somewhat_count: number;
  inaccurate_count: number;
  accuracy_percentage: number;
};

// Forecast Calibration Types
export type SessionForecastSnapshot = {
  id: string;
  session_id: string;
  user_id: string;
  beach_id: string;
  forecast_snapshot: Record<string, any>; // JSONB - forecast data at session time
  actual_conditions: Record<string, any>; // JSONB - actual conditions from session
  forecast_confidence_score: number | null;
  data_source: string | null;
  session_date: string; // DATE
  created_at: string;
  updated_at: string;
};

export type BeachForecastAccuracy = {
  id: string;
  beach_id: string;
  avg_wave_height_delta: number | null;
  avg_wind_speed_delta: number | null;
  avg_confidence_accuracy: number | null;
  total_sessions_count: number;
  last_30_days_count: number;
  last_7_days_count: number;
  overall_accuracy_score: number | null;
  wave_height_accuracy: number | null;
  wind_accuracy: number | null;
  calculation_date: string; // DATE
  updated_at: string;
};

// Database schema with tables
export type Database = {
  public: {
    Tables: {
      beaches: {
        Row: Beach;
        Insert: Omit<Beach, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Beach, "id" | "created_at" | "updated_at">>;
      };
      boards: {
        Row: Board;
        Insert: Omit<Board, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Board, "id" | "created_at" | "updated_at">>;
      };
      sessions: {
        Row: Session;
        Insert: Omit<Session, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Session, "id" | "created_at" | "updated_at">>;
      };
      session_media: {
        Row: SessionMedia;
        Insert: Omit<SessionMedia, "id" | "created_at">;
        Update: Partial<Omit<SessionMedia, "id" | "created_at">>;
      };
      comments: {
        Row: Comment;
        Insert: Omit<Comment, "id" | "created_at">;
        Update: Partial<Omit<Comment, "id" | "created_at">>;
      };
      session_likes: {
        Row: SessionLike;
        Insert: Omit<SessionLike, "id" | "created_at">;
        Update: Partial<Omit<SessionLike, "id" | "created_at">>;
      };
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Profile, "id" | "created_at" | "updated_at">>;
      };
      favorite_beaches: {
        Row: FavoriteBeach;
        Insert: Omit<FavoriteBeach, "id" | "created_at">;
        Update: Partial<Omit<FavoriteBeach, "id" | "created_at">>;
      };
      beach_reviews: {
        Row: BeachReview;
        Insert: Omit<BeachReview, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<BeachReview, "id" | "created_at" | "updated_at">>;
      };
      user_follows: {
        Row: UserFollow;
        Insert: Omit<UserFollow, "id" | "created_at">;
        Update: Partial<Omit<UserFollow, "id" | "created_at">>;
      };
      user_activities: {
        Row: UserActivity;
        Insert: Omit<UserActivity, "id" | "created_at">;
        Update: Partial<Omit<UserActivity, "id" | "created_at">>;
      };
      intel_posts: {
        Row: IntelPost;
        Insert: Omit<IntelPost, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<IntelPost, "id" | "created_at" | "updated_at">>;
      };
      intel_post_confirmations: {
        Row: IntelPostConfirmation;
        Insert: Omit<IntelPostConfirmation, "id" | "created_at">;
        Update: Partial<Omit<IntelPostConfirmation, "id" | "created_at">>;
      };
      session_forecast_snapshots: {
        Row: SessionForecastSnapshot;
        Insert: Omit<
          SessionForecastSnapshot,
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<
          Omit<SessionForecastSnapshot, "id" | "created_at" | "updated_at">
        >;
      };
      beach_forecast_accuracy: {
        Row: BeachForecastAccuracy;
        Insert: Omit<BeachForecastAccuracy, "id" | "updated_at">;
        Update: Partial<Omit<BeachForecastAccuracy, "id" | "updated_at">>;
      };
      check_ins: {
        Row: CheckIn;
        Insert: Omit<CheckIn, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<CheckIn, "id" | "created_at" | "updated_at">>;
      };
      beach_recommendation_calibration: {
        Row: BeachRecommendationCalibration;
        Insert: Omit<BeachRecommendationCalibration, "id" | "updated_at">;
        Update: Partial<
          Omit<BeachRecommendationCalibration, "id" | "updated_at">
        >;
      };
    };
    Functions: {
      get_best_times: {
        Args: {
          p_beach: string;
          p_start: string; // timestamptz ISO string
          p_end: string; // timestamptz ISO string
          p_limit?: number;
        };
        Returns: Array<{
          start_ts: string; // timestamptz ISO string
          end_ts: string; // timestamptz ISO string
          label: string;
          score: number;
        }>;
      };
    };
    Enums: {
      session_status: SessionStatus;
      intel_post_tag: IntelPostTag;
    };
  };
};

export type GetBestTimesRow = {
  start_ts: string;
  end_ts: string;
  label: string;
  score: number;
};
