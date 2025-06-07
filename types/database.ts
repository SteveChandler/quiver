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
   * The owning userʼs profile id (replaces the old `user_id` column that pointed straight at auth.users).
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
    };
    Enums: {
      session_status: SessionStatus;
    };
  };
};
