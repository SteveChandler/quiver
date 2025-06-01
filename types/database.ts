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
  location?: string; // location as text
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
  type: string;
  length?: number;
  width?: number;
  thickness?: number;
  volume?: number;
  brand?: string;
  model?: string;
  created_at: string;
  updated_at: string;
};

export type SessionStatus = "planned" | "completed" | "cancelled";

export type Session = {
  id: string;
  user_id: string;
  beach_id?: string;
  board_id?: string;
  beach_name?: string;
  status: SessionStatus;
  session_date: string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  wave_quality?: number;
  water_temp?: string;
  crowd_level?: number;
  parking_ease?: number;
  notes?: string;
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
