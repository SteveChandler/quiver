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
  location: string;
  latitude: number;
  longitude: number;
  description: string | null;
  wave_quality_rating: number | null;
  crowd_density_rating: number | null;
  parking_rating: number | null;
  accessibility_rating: number | null;
  created_at: string;
  updated_at: string;
};

export type Board = {
  id: string;
  user_id: string;
  name: string;
  board_type: string;
  dimensions: string;
  description: string | null;
  image_url: string | null;
  session_count: number;
  created_at: string;
  updated_at: string;
};

export type Session = {
  id: string;
  user_id: string;
  beach_id: string;
  board_id: string | null;
  session_date: string;
  session_time: string;
  wave_height: string | null;
  water_temp: string | null;
  rating: number;
  crowd_rating: number | null;
  description: string | null;
  image_url: string | null;
  likes_count: number;
  comments_count: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
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
