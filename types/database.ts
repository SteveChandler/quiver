export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  experience_level: string | null;
  favorite_spot: string | null;
  instagram: string | null;
  default_beach_id: string | null;
  notification_session_reminders: boolean;
  notification_community_replies: boolean;
  followers_count: number;
  following_count: number;
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
  created_at: string;
  updated_at: string;
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
    };
    Enums: {
      session_status: SessionStatus;
    };
  };
};
