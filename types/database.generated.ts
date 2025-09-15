export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      badge_definitions: {
        Row: {
          badge_slug: string
          category: string
          created_at: string
          description: string
          icon: string
          name: string
          xp_reward: number
        }
        Insert: {
          badge_slug: string
          category: string
          created_at?: string
          description: string
          icon: string
          name: string
          xp_reward?: number
        }
        Update: {
          badge_slug?: string
          category?: string
          created_at?: string
          description?: string
          icon?: string
          name?: string
          xp_reward?: number
        }
        Relationships: []
      }
      beach_forecast_accuracy: {
        Row: {
          avg_confidence_accuracy: number | null
          avg_wave_height_delta: number | null
          avg_wind_speed_delta: number | null
          beach_id: string
          calculation_date: string
          id: string
          last_30_days_count: number | null
          last_7_days_count: number | null
          overall_accuracy_score: number | null
          total_sessions_count: number | null
          updated_at: string | null
        }
        Insert: {
          avg_confidence_accuracy?: number | null
          avg_wave_height_delta?: number | null
          avg_wind_speed_delta?: number | null
          beach_id: string
          calculation_date?: string
          id?: string
          last_30_days_count?: number | null
          last_7_days_count?: number | null
          overall_accuracy_score?: number | null
          total_sessions_count?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_confidence_accuracy?: number | null
          avg_wave_height_delta?: number | null
          avg_wind_speed_delta?: number | null
          beach_id?: string
          calculation_date?: string
          id?: string
          last_30_days_count?: number | null
          last_7_days_count?: number | null
          overall_accuracy_score?: number | null
          total_sessions_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beach_forecast_accuracy_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
        ]
      }
      beach_recommendation_calibration: {
        Row: {
          beach_id: string
          best_swell_dir_deg_max: number | null
          best_swell_dir_deg_min: number | null
          best_tide_ft_max: number | null
          best_tide_ft_min: number | null
          best_wind_offshore_deg: number | null
          best_wind_tol_deg: number | null
          id: string
          method: string
          metrics: Json | null
          samples_count: number
          skill_level_inferred: string | null
          updated_at: string
          window_end: string
          window_start: string
        }
        Insert: {
          beach_id: string
          best_swell_dir_deg_max?: number | null
          best_swell_dir_deg_min?: number | null
          best_tide_ft_max?: number | null
          best_tide_ft_min?: number | null
          best_wind_offshore_deg?: number | null
          best_wind_tol_deg?: number | null
          id?: string
          method?: string
          metrics?: Json | null
          samples_count?: number
          skill_level_inferred?: string | null
          updated_at?: string
          window_end: string
          window_start: string
        }
        Update: {
          beach_id?: string
          best_swell_dir_deg_max?: number | null
          best_swell_dir_deg_min?: number | null
          best_tide_ft_max?: number | null
          best_tide_ft_min?: number | null
          best_wind_offshore_deg?: number | null
          best_wind_tol_deg?: number | null
          id?: string
          method?: string
          metrics?: Json | null
          samples_count?: number
          skill_level_inferred?: string | null
          updated_at?: string
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "beach_recommendation_calibration_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
        ]
      }
      beach_review_likes: {
        Row: {
          created_at: string
          id: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beach_review_likes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "beach_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_review_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_review_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
        ]
      }
      beach_reviews: {
        Row: {
          accessibility_rating: number
          beach_id: string
          content: string
          created_at: string | null
          crowd_density_rating: number
          helpful_count: number
          id: string
          overall_rating: number
          parking_rating: number
          title: string
          updated_at: string | null
          user_id: string
          visit_date: string | null
          wave_quality_rating: number
        }
        Insert: {
          accessibility_rating: number
          beach_id: string
          content: string
          created_at?: string | null
          crowd_density_rating: number
          helpful_count?: number
          id?: string
          overall_rating: number
          parking_rating: number
          title: string
          updated_at?: string | null
          user_id: string
          visit_date?: string | null
          wave_quality_rating: number
        }
        Update: {
          accessibility_rating?: number
          beach_id?: string
          content?: string
          created_at?: string | null
          crowd_density_rating?: number
          helpful_count?: number
          id?: string
          overall_rating?: number
          parking_rating?: number
          title?: string
          updated_at?: string | null
          user_id?: string
          visit_date?: string | null
          wave_quality_rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "beach_reviews_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
        ]
      }
      beach_sources: {
        Row: {
          beach_id: string
          camera_url: string | null
          created_at: string
          forecast_source_id: string | null
          ndbc_buoy_ids: string[]
        }
        Insert: {
          beach_id: string
          camera_url?: string | null
          created_at?: string
          forecast_source_id?: string | null
          ndbc_buoy_ids?: string[]
        }
        Update: {
          beach_id?: string
          camera_url?: string | null
          created_at?: string
          forecast_source_id?: string | null
          ndbc_buoy_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "beach_sources_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
        ]
      }
      beaches: {
        Row: {
          aspect_deg: number | null
          break_type: string | null
          coordinates: unknown | null
          country: string | null
          created_at: string
          hazards: string[] | null
          id: string
          is_private: boolean
          latitude: number | null
          location: string | null
          longitude: number | null
          name: string
          offshore_deg: number | null
          owner_id: string | null
          preference_model: Json | null
          preferred_tide_ft_max: number | null
          preferred_tide_ft_min: number | null
          region: string | null
          region_id: string | null
          shoreline_aspect_deg: number | null
          skill_level: string | null
          swell_window_center_deg: number | null
          swell_window_halfwidth_deg: number | null
          swell_window_max_deg: number | null
          swell_window_min_deg: number | null
          tide_max_ft: number | null
          tide_min_ft: number | null
          wind_cross_ok_kts: number | null
          wind_cross_shore_ok_kt: number | null
          wind_offshore_deg: number | null
          wind_offshore_tol_deg: number | null
          wind_onshore_bad_kt: number | null
          wind_onshore_bad_kts: number | null
        }
        Insert: {
          aspect_deg?: number | null
          break_type?: string | null
          coordinates?: unknown | null
          country?: string | null
          created_at?: string
          hazards?: string[] | null
          id?: string
          is_private?: boolean
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          name: string
          offshore_deg?: number | null
          owner_id?: string | null
          preference_model?: Json | null
          preferred_tide_ft_max?: number | null
          preferred_tide_ft_min?: number | null
          region?: string | null
          region_id?: string | null
          shoreline_aspect_deg?: number | null
          skill_level?: string | null
          swell_window_center_deg?: number | null
          swell_window_halfwidth_deg?: number | null
          swell_window_max_deg?: number | null
          swell_window_min_deg?: number | null
          tide_max_ft?: number | null
          tide_min_ft?: number | null
          wind_cross_ok_kts?: number | null
          wind_cross_shore_ok_kt?: number | null
          wind_offshore_deg?: number | null
          wind_offshore_tol_deg?: number | null
          wind_onshore_bad_kt?: number | null
          wind_onshore_bad_kts?: number | null
        }
        Update: {
          aspect_deg?: number | null
          break_type?: string | null
          coordinates?: unknown | null
          country?: string | null
          created_at?: string
          hazards?: string[] | null
          id?: string
          is_private?: boolean
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          name?: string
          offshore_deg?: number | null
          owner_id?: string | null
          preference_model?: Json | null
          preferred_tide_ft_max?: number | null
          preferred_tide_ft_min?: number | null
          region?: string | null
          region_id?: string | null
          shoreline_aspect_deg?: number | null
          skill_level?: string | null
          swell_window_center_deg?: number | null
          swell_window_halfwidth_deg?: number | null
          swell_window_max_deg?: number | null
          swell_window_min_deg?: number | null
          tide_max_ft?: number | null
          tide_min_ft?: number | null
          wind_cross_ok_kts?: number | null
          wind_cross_shore_ok_kt?: number | null
          wind_offshore_deg?: number | null
          wind_offshore_tol_deg?: number | null
          wind_onshore_bad_kt?: number | null
          wind_onshore_bad_kts?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "beaches_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beaches_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          board_type: string
          created_at: string | null
          description: string | null
          dimensions: string
          id: string
          image_url: string | null
          name: string
          session_count: number | null
          size: string | null
          updated_at: string | null
          user_id: string
          volume: number | null
        }
        Insert: {
          board_type: string
          created_at?: string | null
          description?: string | null
          dimensions: string
          id?: string
          image_url?: string | null
          name: string
          session_count?: number | null
          size?: string | null
          updated_at?: string | null
          user_id: string
          volume?: number | null
        }
        Update: {
          board_type?: string
          created_at?: string | null
          description?: string | null
          dimensions?: string
          id?: string
          image_url?: string | null
          name?: string
          session_count?: number | null
          size?: string | null
          updated_at?: string | null
          user_id?: string
          volume?: number | null
        }
        Relationships: []
      }
      buoys: {
        Row: {
          active: boolean
          air_temperature: number | null
          buoy_name: string | null
          buoy_uuid: string
          coordinates: unknown | null
          tides: Json | null
          updated_at: string
          water_temperature: number | null
          wave_height: number | null
          wave_period: number | null
          wind_direction: number | null
          wind_gust: number | null
          wind_speed: number | null
        }
        Insert: {
          active?: boolean
          air_temperature?: number | null
          buoy_name?: string | null
          buoy_uuid: string
          coordinates?: unknown | null
          tides?: Json | null
          updated_at?: string
          water_temperature?: number | null
          wave_height?: number | null
          wave_period?: number | null
          wind_direction?: number | null
          wind_gust?: number | null
          wind_speed?: number | null
        }
        Update: {
          active?: boolean
          air_temperature?: number | null
          buoy_name?: string | null
          buoy_uuid?: string
          coordinates?: unknown | null
          tides?: Json | null
          updated_at?: string
          water_temperature?: number | null
          wave_height?: number | null
          wave_period?: number | null
          wind_direction?: number | null
          wind_gust?: number | null
          wind_speed?: number | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
        ]
      }
      enhanced_forecasts: {
        Row: {
          air_temperature: string | null
          beach_id: string
          confidence_score: number
          created_at: string
          data_source: string | null
          forecast_date: string
          forecast_time: string
          id: string
          next_tide_height: string | null
          next_tide_time: string | null
          next_tide_type: string | null
          raw_forecast: Json | null
          swell_1_direction: string | null
          swell_1_height: string | null
          swell_1_period: string | null
          swell_2_direction: string | null
          swell_2_height: string | null
          swell_2_period: string | null
          tide_height: string | null
          tide_status: string | null
          updated_at: string
          water_temp: string | null
          wave_direction: string | null
          wave_height: string | null
          wave_period: string | null
          weather_condition: string | null
          wind_direction: string | null
          wind_speed: string | null
          wind_wave_direction: string | null
          wind_wave_height: string | null
          wind_wave_period: string | null
        }
        Insert: {
          air_temperature?: string | null
          beach_id: string
          confidence_score?: number
          created_at?: string
          data_source?: string | null
          forecast_date: string
          forecast_time: string
          id?: string
          next_tide_height?: string | null
          next_tide_time?: string | null
          next_tide_type?: string | null
          raw_forecast?: Json | null
          swell_1_direction?: string | null
          swell_1_height?: string | null
          swell_1_period?: string | null
          swell_2_direction?: string | null
          swell_2_height?: string | null
          swell_2_period?: string | null
          tide_height?: string | null
          tide_status?: string | null
          updated_at?: string
          water_temp?: string | null
          wave_direction?: string | null
          wave_height?: string | null
          wave_period?: string | null
          weather_condition?: string | null
          wind_direction?: string | null
          wind_speed?: string | null
          wind_wave_direction?: string | null
          wind_wave_height?: string | null
          wind_wave_period?: string | null
        }
        Update: {
          air_temperature?: string | null
          beach_id?: string
          confidence_score?: number
          created_at?: string
          data_source?: string | null
          forecast_date?: string
          forecast_time?: string
          id?: string
          next_tide_height?: string | null
          next_tide_time?: string | null
          next_tide_type?: string | null
          raw_forecast?: Json | null
          swell_1_direction?: string | null
          swell_1_height?: string | null
          swell_1_period?: string | null
          swell_2_direction?: string | null
          swell_2_height?: string | null
          swell_2_period?: string | null
          tide_height?: string | null
          tide_status?: string | null
          updated_at?: string
          water_temp?: string | null
          wave_direction?: string | null
          wave_height?: string | null
          wave_period?: string | null
          weather_condition?: string | null
          wind_direction?: string | null
          wind_speed?: string | null
          wind_wave_direction?: string | null
          wind_wave_height?: string | null
          wind_wave_period?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enhanced_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
        ]
      }
      favorite_beaches: {
        Row: {
          beach_id: string
          created_at: string | null
          id: string
          rank: number | null
          user_id: string
        }
        Insert: {
          beach_id: string
          created_at?: string | null
          id?: string
          rank?: number | null
          user_id: string
        }
        Update: {
          beach_id?: string
          created_at?: string | null
          id?: string
          rank?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorite_beaches_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_beaches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_beaches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
        ]
      }
      intel_post_confirmations: {
        Row: {
          created_at: string
          id: string
          intel_post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          intel_post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          intel_post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intel_post_confirmations_intel_post_id_fkey"
            columns: ["intel_post_id"]
            isOneToOne: false
            referencedRelation: "intel_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_post_confirmations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_post_confirmations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
        ]
      }
      intel_posts: {
        Row: {
          beach_id: string | null
          confirmations_count: number
          created_at: string
          description: string
          expires_at: string | null
          id: string
          is_active: boolean
          latitude: number
          longitude: number
          photo_storage_path: string | null
          photo_url: string | null
          surf_conditions: Json | null
          tag: Database["public"]["Enums"]["intel_post_tag"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          beach_id?: string | null
          confirmations_count?: number
          created_at?: string
          description: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          latitude: number
          longitude: number
          photo_storage_path?: string | null
          photo_url?: string | null
          surf_conditions?: Json | null
          tag: Database["public"]["Enums"]["intel_post_tag"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          beach_id?: string | null
          confirmations_count?: number
          created_at?: string
          description?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          latitude?: number
          longitude?: number
          photo_storage_path?: string | null
          photo_url?: string | null
          surf_conditions?: Json | null
          tag?: Database["public"]["Enums"]["intel_post_tag"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intel_posts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
        ]
      }
      marine_forecasts: {
        Row: {
          beach_id: string
          created_at: string
          hs_m: number | null
          id: string
          is_observed: boolean
          source: string
          swell_dir_deg: number | null
          tp_s: number | null
          ts: string
          ts_utc: string | null
          wave_direction_deg: number | null
          wave_height_m: number | null
          wave_period_s: number | null
          wind_dir_deg: number | null
          wind_direction_deg: number | null
          wind_spd_kts: number | null
          wind_speed_ms: number | null
        }
        Insert: {
          beach_id: string
          created_at?: string
          hs_m?: number | null
          id?: string
          is_observed?: boolean
          source: string
          swell_dir_deg?: number | null
          tp_s?: number | null
          ts: string
          ts_utc?: string | null
          wave_direction_deg?: number | null
          wave_height_m?: number | null
          wave_period_s?: number | null
          wind_dir_deg?: number | null
          wind_direction_deg?: number | null
          wind_spd_kts?: number | null
          wind_speed_ms?: number | null
        }
        Update: {
          beach_id?: string
          created_at?: string
          hs_m?: number | null
          id?: string
          is_observed?: boolean
          source?: string
          swell_dir_deg?: number | null
          tp_s?: number | null
          ts?: string
          ts_utc?: string | null
          wave_direction_deg?: number | null
          wave_height_m?: number | null
          wave_period_s?: number | null
          wind_dir_deg?: number | null
          wind_direction_deg?: number | null
          wind_spd_kts?: number | null
          wind_speed_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marine_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          digest_session_invites: boolean
          email: string | null
          email_session_invites: boolean
          experience_level: string | null
          favorite_spot: string | null
          favorite_spot_id: string | null
          followers_count: number | null
          following_count: number | null
          full_name: string | null
          home_beach_id: string | null
          id: string
          inapp_session_invites: boolean
          instagram: string | null
          is_mock: boolean
          location: string | null
          phone_number: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          digest_session_invites?: boolean
          email?: string | null
          email_session_invites?: boolean
          experience_level?: string | null
          favorite_spot?: string | null
          favorite_spot_id?: string | null
          followers_count?: number | null
          following_count?: number | null
          full_name?: string | null
          home_beach_id?: string | null
          id?: string
          inapp_session_invites?: boolean
          instagram?: string | null
          is_mock?: boolean
          location?: string | null
          phone_number?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          digest_session_invites?: boolean
          email?: string | null
          email_session_invites?: boolean
          experience_level?: string | null
          favorite_spot?: string | null
          favorite_spot_id?: string | null
          followers_count?: number | null
          following_count?: number | null
          full_name?: string | null
          home_beach_id?: string | null
          id?: string
          inapp_session_invites?: boolean
          instagram?: string | null
          is_mock?: boolean
          location?: string | null
          phone_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_favorite_spot_id_fkey"
            columns: ["favorite_spot_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_home_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
        ]
      }
      session_forecast_snapshots: {
        Row: {
          actual_conditions: Json
          beach_id: string
          created_at: string | null
          data_source: string | null
          forecast_confidence_score: number | null
          forecast_snapshot: Json
          id: string
          session_date: string
          session_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          actual_conditions: Json
          beach_id: string
          created_at?: string | null
          data_source?: string | null
          forecast_confidence_score?: number | null
          forecast_snapshot: Json
          id?: string
          session_date: string
          session_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          actual_conditions?: Json
          beach_id?: string
          created_at?: string | null
          data_source?: string | null
          forecast_confidence_score?: number | null
          forecast_snapshot?: Json
          id?: string
          session_date?: string
          session_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_forecast_snapshots_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_forecast_snapshots_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_forecast_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_forecast_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
        ]
      }
      session_invitations: {
        Row: {
          created_at: string | null
          id: string
          idempotency_key: string | null
          invitee_email: string | null
          invitee_id: string | null
          inviter_id: string
          message: string | null
          responded_at: string | null
          session_id: string
          status: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          idempotency_key?: string | null
          invitee_email?: string | null
          invitee_id?: string | null
          inviter_id: string
          message?: string | null
          responded_at?: string | null
          session_id: string
          status?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          idempotency_key?: string | null
          invitee_email?: string | null
          invitee_id?: string | null
          inviter_id?: string
          message?: string | null
          responded_at?: string | null
          session_id?: string
          status?: string
        }
        Relationships: []
      }
      session_likes: {
        Row: {
          created_at: string
          id: string
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_likes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          arrival_time: string
          beach_id: string
          beach_name: string | null
          board_id: string | null
          comments_count: number
          created_at: string
          crowd_level: number | null
          description: string | null
          duration_minutes: number
          goals: string[]
          id: string
          image_url: string | null
          invitee_ids: string[]
          is_public: boolean | null
          likes_count: number
          notes: string | null
          parking_ease: number | null
          profile_id: string
          rating: number | null
          status: string | null
          user_id: string
          water_temp: number | null
          wave_quality: number | null
        }
        Insert: {
          arrival_time?: string
          beach_id: string
          beach_name?: string | null
          board_id?: string | null
          comments_count?: number
          created_at?: string
          crowd_level?: number | null
          description?: string | null
          duration_minutes?: number
          goals?: string[]
          id?: string
          image_url?: string | null
          invitee_ids?: string[]
          is_public?: boolean | null
          likes_count?: number
          notes?: string | null
          parking_ease?: number | null
          profile_id: string
          rating?: number | null
          status?: string | null
          user_id: string
          water_temp?: number | null
          wave_quality?: number | null
        }
        Update: {
          arrival_time?: string
          beach_id?: string
          beach_name?: string | null
          board_id?: string | null
          comments_count?: number
          created_at?: string
          crowd_level?: number | null
          description?: string | null
          duration_minutes?: number
          goals?: string[]
          id?: string
          image_url?: string | null
          invitee_ids?: string[]
          is_public?: boolean | null
          likes_count?: number
          notes?: string | null
          parking_ease?: number | null
          profile_id?: string
          rating?: number | null
          status?: string | null
          user_id?: string
          water_temp?: number | null
          wave_quality?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      spot_feedback: {
        Row: {
          accurate: boolean
          created_at: string
          id: string
          note: string | null
          reasons: string[] | null
          rec_id: string | null
          spot_id: string
          user_id: string
        }
        Insert: {
          accurate: boolean
          created_at?: string
          id?: string
          note?: string | null
          reasons?: string[] | null
          rec_id?: string | null
          spot_id: string
          user_id: string
        }
        Update: {
          accurate?: boolean
          created_at?: string
          id?: string
          note?: string | null
          reasons?: string[] | null
          rec_id?: string | null
          spot_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spot_feedback_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
        ]
      }
      sun_times: {
        Row: {
          beach_id: string
          created_at: string
          date: string
          id: string
          source: string
          sunrise_utc: string | null
          sunset_utc: string | null
        }
        Insert: {
          beach_id: string
          created_at?: string
          date: string
          id?: string
          source: string
          sunrise_utc?: string | null
          sunset_utc?: string | null
        }
        Update: {
          beach_id?: string
          created_at?: string
          date?: string
          id?: string
          source?: string
          sunrise_utc?: string | null
          sunset_utc?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sun_times_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
        ]
      }
      tide_forecasts: {
        Row: {
          beach_id: string
          created_at: string
          id: string
          source: string
          tide_ft: number | null
          tide_height_m: number | null
          tide_phase: string | null
          ts: string
          ts_utc: string | null
        }
        Insert: {
          beach_id: string
          created_at?: string
          id?: string
          source: string
          tide_ft?: number | null
          tide_height_m?: number | null
          tide_phase?: string | null
          ts: string
          ts_utc?: string | null
        }
        Update: {
          beach_id?: string
          created_at?: string
          id?: string
          source?: string
          tide_ft?: number | null
          tide_height_m?: number | null
          tide_phase?: string | null
          ts?: string
          ts_utc?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tide_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activities: {
        Row: {
          activity_type: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_slug: string
          context: Json | null
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          badge_slug: string
          context?: Json | null
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          badge_slug?: string
          context?: Json | null
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_slug_fkey"
            columns: ["badge_slug"]
            isOneToOne: false
            referencedRelation: "badge_definitions"
            referencedColumns: ["badge_slug"]
          },
        ]
      }
      user_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
        ]
      }
      user_xp: {
        Row: {
          created_at: string
          id: string
          level: number
          updated_at: string
          user_id: string
          xp_total: number
        }
        Insert: {
          created_at?: string
          id?: string
          level?: number
          updated_at?: string
          user_id: string
          xp_total?: number
        }
        Update: {
          created_at?: string
          id?: string
          level?: number
          updated_at?: string
          user_id?: string
          xp_total?: number
        }
        Relationships: []
      }
      xp_events: {
        Row: {
          action: string
          created_at: string
          id: string
          related_entity_id: string | null
          related_entity_type: string | null
          user_id: string
          xp_amount: number
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          user_id: string
          xp_amount: number
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          user_id?: string
          xp_amount?: number
        }
        Relationships: []
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown | null
          f_table_catalog: unknown | null
          f_table_name: unknown | null
          f_table_schema: unknown | null
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown | null
          f_table_catalog: string | null
          f_table_name: unknown | null
          f_table_schema: unknown | null
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown | null
          f_table_catalog?: string | null
          f_table_name?: unknown | null
          f_table_schema?: unknown | null
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown | null
          f_table_catalog?: string | null
          f_table_name?: unknown | null
          f_table_schema?: unknown | null
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      mv_beach_hourly_scores: {
        Row: {
          beach_id: string | null
          hs_m: number | null
          score_0_100: number | null
          swell_dir_deg: number | null
          tide_ft: number | null
          tp_s: number | null
          ts_utc: string | null
          wind_dir_deg: number | null
          wind_spd_kts: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marine_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_best_times: {
        Row: {
          beach_id: string | null
          end_ts: string | null
          grade: string | null
          score: number | null
          start_ts: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marine_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_with_home_beach: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          digest_session_invites: boolean | null
          email: string | null
          email_session_invites: boolean | null
          experience_level: string | null
          favorite_spot: string | null
          favorite_spot_id: string | null
          followers_count: number | null
          following_count: number | null
          full_name: string | null
          home_beach_id: string | null
          home_beach_name: string | null
          id: string | null
          inapp_session_invites: boolean | null
          instagram: string | null
          is_mock: boolean | null
          location: string | null
          phone_number: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_favorite_spot_id_fkey"
            columns: ["favorite_spot_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_home_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
        ]
      }
      ten_day_enhanced_forecasts: {
        Row: {
          air_temperature: string | null
          beach_id: string | null
          confidence_score: number | null
          created_at: string | null
          data_source: string | null
          forecast_date: string | null
          forecast_time: string | null
          id: string | null
          next_tide_height: string | null
          next_tide_time: string | null
          next_tide_type: string | null
          raw_forecast: Json | null
          swell_1_direction: string | null
          swell_1_height: string | null
          swell_1_period: string | null
          swell_2_direction: string | null
          swell_2_height: string | null
          swell_2_period: string | null
          tide_height: string | null
          tide_status: string | null
          updated_at: string | null
          water_temp: string | null
          wave_direction: string | null
          wave_height: string | null
          wave_period: string | null
          weather_condition: string | null
          wind_direction: string | null
          wind_speed: string | null
          wind_wave_direction: string | null
          wind_wave_height: string | null
          wind_wave_period: string | null
        }
        Insert: {
          air_temperature?: string | null
          beach_id?: string | null
          confidence_score?: number | null
          created_at?: string | null
          data_source?: string | null
          forecast_date?: string | null
          forecast_time?: string | null
          id?: string | null
          next_tide_height?: string | null
          next_tide_time?: string | null
          next_tide_type?: string | null
          raw_forecast?: Json | null
          swell_1_direction?: string | null
          swell_1_height?: string | null
          swell_1_period?: string | null
          swell_2_direction?: string | null
          swell_2_height?: string | null
          swell_2_period?: string | null
          tide_height?: string | null
          tide_status?: string | null
          updated_at?: string | null
          water_temp?: string | null
          wave_direction?: string | null
          wave_height?: string | null
          wave_period?: string | null
          weather_condition?: string | null
          wind_direction?: string | null
          wind_speed?: string | null
          wind_wave_direction?: string | null
          wind_wave_height?: string | null
          wind_wave_period?: string | null
        }
        Update: {
          air_temperature?: string | null
          beach_id?: string | null
          confidence_score?: number | null
          created_at?: string | null
          data_source?: string | null
          forecast_date?: string | null
          forecast_time?: string | null
          id?: string | null
          next_tide_height?: string | null
          next_tide_time?: string | null
          next_tide_type?: string | null
          raw_forecast?: Json | null
          swell_1_direction?: string | null
          swell_1_height?: string | null
          swell_1_period?: string | null
          swell_2_direction?: string | null
          swell_2_height?: string | null
          swell_2_period?: string | null
          tide_height?: string | null
          tide_status?: string | null
          updated_at?: string | null
          water_temp?: string | null
          wave_direction?: string | null
          wave_height?: string | null
          wave_period?: string | null
          weather_condition?: string | null
          wind_direction?: string | null
          wind_speed?: string | null
          wind_wave_direction?: string | null
          wind_wave_height?: string | null
          wind_wave_period?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enhanced_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
        ]
      }
      v_beach_hourly_scores: {
        Row: {
          beach_id: string | null
          height_score: number | null
          period_score: number | null
          score_0_100: number | null
          swell_dir_score: number | null
          tide_score: number | null
          ts_utc: string | null
          wind_off_by_deg: number | null
          wind_score: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marine_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      _postgis_scripts_pgsql_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_bestsrid: {
        Args: { "": unknown }
        Returns: number
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_covers: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_pointoutside: {
        Args: { "": unknown }
        Returns: unknown
      }
      _st_sortablehash: {
        Args: { geom: unknown }
        Returns: number
      }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      addauth: {
        Args: { "": string }
        Returns: boolean
      }
      addgeometrycolumn: {
        Args:
          | {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
          | {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
          | {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
        Returns: string
      }
      box: {
        Args: { "": unknown } | { "": unknown }
        Returns: unknown
      }
      box2d: {
        Args: { "": unknown } | { "": unknown }
        Returns: unknown
      }
      box2d_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      box2d_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      box2df_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      box2df_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      box3d: {
        Args: { "": unknown } | { "": unknown }
        Returns: unknown
      }
      box3d_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      box3d_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      box3dtobox: {
        Args: { "": unknown }
        Returns: unknown
      }
      bytea: {
        Args: { "": unknown } | { "": unknown }
        Returns: string
      }
      check_database_health: {
        Args: Record<PropertyKey, never>
        Returns: {
          last_analyzed: string
          row_count: number
          table_name: string
          table_size: string
        }[]
      }
      cleanup_inactive_buoys: {
        Args: { inactive_days?: number }
        Returns: number
      }
      cleanup_old_forecasts: {
        Args: { retention_days?: number }
        Returns: number
      }
      cleanup_stale_enhanced_forecasts: {
        Args: { retention_days?: number }
        Returns: number
      }
      concat_text_array: {
        Args: { vals: string[] }
        Returns: string
      }
      create_activity: {
        Args: {
          p_activity_type: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
          p_user_id: string
        }
        Returns: string
      }
      disablelongtransactions: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      dropgeometrycolumn: {
        Args:
          | {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
          | { column_name: string; schema_name: string; table_name: string }
          | { column_name: string; table_name: string }
        Returns: string
      }
      dropgeometrytable: {
        Args:
          | { catalog_name: string; schema_name: string; table_name: string }
          | { schema_name: string; table_name: string }
          | { table_name: string }
        Returns: string
      }
      enablelongtransactions: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      equals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geography: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      geography_analyze: {
        Args: { "": unknown }
        Returns: boolean
      }
      geography_gist_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      geography_gist_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      geography_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      geography_send: {
        Args: { "": unknown }
        Returns: string
      }
      geography_spgist_compress_nd: {
        Args: { "": unknown }
        Returns: unknown
      }
      geography_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      geography_typmod_out: {
        Args: { "": number }
        Returns: unknown
      }
      geometry: {
        Args:
          | { "": string }
          | { "": string }
          | { "": unknown }
          | { "": unknown }
          | { "": unknown }
          | { "": unknown }
          | { "": unknown }
          | { "": unknown }
        Returns: unknown
      }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_analyze: {
        Args: { "": unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gist_compress_2d: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_gist_compress_nd: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_gist_decompress_2d: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_gist_decompress_nd: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_gist_sortsupport_2d: {
        Args: { "": unknown }
        Returns: undefined
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_hash: {
        Args: { "": unknown }
        Returns: number
      }
      geometry_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_recv: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_send: {
        Args: { "": unknown }
        Returns: string
      }
      geometry_sortsupport: {
        Args: { "": unknown }
        Returns: undefined
      }
      geometry_spgist_compress_2d: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_spgist_compress_3d: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_spgist_compress_nd: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      geometry_typmod_out: {
        Args: { "": number }
        Returns: unknown
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometrytype: {
        Args: { "": unknown } | { "": unknown }
        Returns: string
      }
      geomfromewkb: {
        Args: { "": string }
        Returns: unknown
      }
      geomfromewkt: {
        Args: { "": string }
        Returns: unknown
      }
      get_beach_review_stats: {
        Args: { target_beach_id: string }
        Returns: {
          average_accessibility: number
          average_crowd_density: number
          average_overall_rating: number
          average_parking: number
          average_wave_quality: number
          beach_id: string
          rating_distribution: Json
          total_reviews: number
        }[]
      }
      get_beach_reviews: {
        Args: {
          limit_count?: number
          min_rating?: number
          offset_count?: number
          target_beach_id: string
        }
        Returns: {
          accessibility_rating: number
          beach_id: string
          beach_name: string
          content: string
          created_at: string
          crowd_density_rating: number
          helpful_count: number
          id: string
          overall_rating: number
          parking_rating: number
          title: string
          updated_at: string
          user_id: string
          user_name: string
          visit_date: string
          wave_quality_rating: number
        }[]
      }
      get_beaches_near: {
        Args: { _lat: number; _lon: number; _radius_km?: number }
        Returns: {
          aspect_deg: number
          break_type: string
          dist_km: number
          id: string
          lat: number
          lon: number
          name: string
          offshore_deg: number
          swell_window_center_deg: number
          swell_window_halfwidth_deg: number
          tide_max_ft: number
          tide_min_ft: number
          wind_cross_ok_kts: number
          wind_onshore_bad_kts: number
        }[]
      }
      get_best_times: {
        Args: {
          p_beach: string
          p_end: string
          p_limit?: number
          p_start: string
        }
        Returns: {
          end_ts: string
          label: string
          score: number
          start_ts: string
        }[]
      }
      get_coach_picks: {
        Args: { _beach_id: string; _radius_km?: number }
        Returns: {
          beach_id: string
          distance_km: number
          name: string
          pick_rank: number
          score: number
        }[]
      }
      get_intel_confirmations: {
        Args: { target_post_id: string }
        Returns: {
          created_at: string
          id: string
          intel_post_id: string
          user_id: string
          user_name: string
        }[]
      }
      get_nearby_beaches: {
        Args: {
          input_lat: number
          input_lng: number
          limit_count?: number
          max_distance_meters?: number
        }
        Returns: {
          distance_meters: number
          id: string
          is_private: boolean
          latitude: number
          location: string
          longitude: number
          name: string
        }[]
      }
      get_nearby_buoys: {
        Args: {
          max_distance_m?: number
          result_limit?: number
          target_lat: number
          target_lng: number
        }
        Returns: {
          active: boolean
          air_temperature: number
          buoy_name: string
          buoy_uuid: string
          coordinates: unknown
          distance_meters: number
          tides: Json
          updated_at: string
          water_temperature: number
          wave_height: number
          wave_period: number
          wind_direction: number
          wind_gust: number
          wind_speed: number
        }[]
      }
      get_nearby_intel_posts: {
        Args: {
          center_lat: number
          center_lng: number
          limit_count?: number
          radius_miles?: number
          tag_filter?: string
        }
        Returns: {
          beach_id: string
          beach_name: string
          confirmations_count: number
          created_at: string
          description: string
          distance_miles: number
          expires_at: string
          id: string
          is_active: boolean
          latitude: number
          longitude: number
          photo_url: string
          surf_conditions: Json
          tag: Database["public"]["Enums"]["intel_post_tag"]
          title: string
          updated_at: string
          user_id: string
          user_name: string
        }[]
      }
      get_nearest_buoy_with_conditions: {
        Args: {
          max_distance_m?: number
          target_lat: number
          target_lng: number
        }
        Returns: {
          active: boolean
          air_temperature: number
          buoy_name: string
          buoy_uuid: string
          coordinates: unknown
          distance_meters: number
          tides: Json
          updated_at: string
          water_temperature: number
          wave_height: number
          wave_period: number
          wind_direction: number
          wind_gust: number
          wind_speed: number
        }[]
      }
      get_proj4_from_srid: {
        Args: { "": number }
        Returns: string
      }
      gettransactionid: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      gidx_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gidx_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      json: {
        Args: { "": unknown }
        Returns: Json
      }
      jsonb: {
        Args: { "": unknown }
        Returns: Json
      }
      longtransactionsenabled: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      nightly_forecast_maintenance: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      path: {
        Args: { "": unknown }
        Returns: unknown
      }
      pgis_asflatgeobuf_finalfn: {
        Args: { "": unknown }
        Returns: string
      }
      pgis_asgeobuf_finalfn: {
        Args: { "": unknown }
        Returns: string
      }
      pgis_asmvt_finalfn: {
        Args: { "": unknown }
        Returns: string
      }
      pgis_asmvt_serialfn: {
        Args: { "": unknown }
        Returns: string
      }
      pgis_geometry_clusterintersecting_finalfn: {
        Args: { "": unknown }
        Returns: unknown[]
      }
      pgis_geometry_clusterwithin_finalfn: {
        Args: { "": unknown }
        Returns: unknown[]
      }
      pgis_geometry_collect_finalfn: {
        Args: { "": unknown }
        Returns: unknown
      }
      pgis_geometry_makeline_finalfn: {
        Args: { "": unknown }
        Returns: unknown
      }
      pgis_geometry_polygonize_finalfn: {
        Args: { "": unknown }
        Returns: unknown
      }
      pgis_geometry_union_parallel_finalfn: {
        Args: { "": unknown }
        Returns: unknown
      }
      pgis_geometry_union_parallel_serialfn: {
        Args: { "": unknown }
        Returns: string
      }
      point: {
        Args: { "": unknown }
        Returns: unknown
      }
      polygon: {
        Args: { "": unknown }
        Returns: unknown
      }
      populate_geometry_columns: {
        Args:
          | { tbl_oid: unknown; use_typmod?: boolean }
          | { use_typmod?: boolean }
        Returns: string
      }
      postgis_addbbox: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_dropbbox: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_extensions_upgrade: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_full_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_geos_noop: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_geos_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_getbbox: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_hasbbox: {
        Args: { "": unknown }
        Returns: boolean
      }
      postgis_index_supportfn: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_lib_build_date: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_lib_revision: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_lib_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_libjson_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_liblwgeom_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_libprotobuf_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_libxml_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_noop: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_proj_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_scripts_build_date: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_scripts_installed: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_scripts_released: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_svn_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_typmod_dims: {
        Args: { "": number }
        Returns: number
      }
      postgis_typmod_srid: {
        Args: { "": number }
        Returns: number
      }
      postgis_typmod_type: {
        Args: { "": number }
        Returns: string
      }
      postgis_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_wagyu_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      refresh_enhanced_forecasts_for_active_beaches: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      refresh_mv_beach_hourly_scores: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_mv_beach_hourly_scores_and_analyze: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_mv_best_times: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      run_database_maintenance: {
        Args: {
          buoy_inactive_days?: number
          cleanup_buoys?: boolean
          cleanup_forecasts?: boolean
          forecast_retention_days?: number
          update_stats?: boolean
        }
        Returns: Json
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      spheroid_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      spheroid_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlength: {
        Args: { "": unknown }
        Returns: number
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dperimeter: {
        Args: { "": unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle: {
        Args:
          | { line1: unknown; line2: unknown }
          | { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
        Returns: number
      }
      st_area: {
        Args:
          | { "": string }
          | { "": unknown }
          | { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_area2d: {
        Args: { "": unknown }
        Returns: number
      }
      st_asbinary: {
        Args: { "": unknown } | { "": unknown }
        Returns: string
      }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkb: {
        Args: { "": unknown }
        Returns: string
      }
      st_asewkt: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      st_asgeojson: {
        Args:
          | { "": string }
          | { geog: unknown; maxdecimaldigits?: number; options?: number }
          | { geom: unknown; maxdecimaldigits?: number; options?: number }
          | {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
        Returns: string
      }
      st_asgml: {
        Args:
          | { "": string }
          | {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
          | {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
          | {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
          | { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_ashexewkb: {
        Args: { "": unknown }
        Returns: string
      }
      st_askml: {
        Args:
          | { "": string }
          | { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
          | { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
        Returns: string
      }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: {
        Args: { format?: string; geom: unknown }
        Returns: string
      }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg: {
        Args:
          | { "": string }
          | { geog: unknown; maxdecimaldigits?: number; rel?: number }
          | { geom: unknown; maxdecimaldigits?: number; rel?: number }
        Returns: string
      }
      st_astext: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      st_astwkb: {
        Args:
          | {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
          | {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
        Returns: string
      }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_boundary: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer: {
        Args:
          | { geom: unknown; options?: string; radius: number }
          | { geom: unknown; quadsegs: number; radius: number }
        Returns: unknown
      }
      st_buildarea: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_centroid: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      st_cleangeometry: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_clusterintersecting: {
        Args: { "": unknown[] }
        Returns: unknown[]
      }
      st_collect: {
        Args: { "": unknown[] } | { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collectionextract: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_collectionhomogenize: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_convexhull: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_coorddim: {
        Args: { geometry: unknown }
        Returns: number
      }
      st_coveredby: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_covers: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_dimension: {
        Args: { "": unknown }
        Returns: number
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance: {
        Args:
          | { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
          | { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_distancesphere: {
        Args:
          | { geom1: unknown; geom2: unknown }
          | { geom1: unknown; geom2: unknown; radius: number }
        Returns: number
      }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dump: {
        Args: { "": unknown }
        Returns: Database["public"]["CompositeTypes"]["geometry_dump"][]
      }
      st_dumppoints: {
        Args: { "": unknown }
        Returns: Database["public"]["CompositeTypes"]["geometry_dump"][]
      }
      st_dumprings: {
        Args: { "": unknown }
        Returns: Database["public"]["CompositeTypes"]["geometry_dump"][]
      }
      st_dumpsegments: {
        Args: { "": unknown }
        Returns: Database["public"]["CompositeTypes"]["geometry_dump"][]
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_endpoint: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_envelope: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_equals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_expand: {
        Args:
          | { box: unknown; dx: number; dy: number }
          | { box: unknown; dx: number; dy: number; dz?: number }
          | { dm?: number; dx: number; dy: number; dz?: number; geom: unknown }
        Returns: unknown
      }
      st_exteriorring: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_flipcoordinates: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_force2d: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_force3d: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_forcecollection: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_forcecurve: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_forcepolygonccw: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_forcepolygoncw: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_forcerhr: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_forcesfs: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_generatepoints: {
        Args:
          | { area: unknown; npoints: number }
          | { area: unknown; npoints: number; seed: number }
        Returns: unknown
      }
      st_geogfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_geogfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_geographyfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_geohash: {
        Args:
          | { geog: unknown; maxchars?: number }
          | { geom: unknown; maxchars?: number }
        Returns: string
      }
      st_geomcollfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomcollfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_geometrytype: {
        Args: { "": unknown }
        Returns: string
      }
      st_geomfromewkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfromewkt: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfromgeojson: {
        Args: { "": Json } | { "": Json } | { "": string }
        Returns: unknown
      }
      st_geomfromgml: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfromkml: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfrommarc21: {
        Args: { marc21xml: string }
        Returns: unknown
      }
      st_geomfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfromtwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_gmltosql: {
        Args: { "": string }
        Returns: unknown
      }
      st_hasarc: {
        Args: { geometry: unknown }
        Returns: boolean
      }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_isclosed: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_iscollection: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_isempty: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_ispolygonccw: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_ispolygoncw: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_isring: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_issimple: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_isvalid: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
      }
      st_isvalidreason: {
        Args: { "": unknown }
        Returns: string
      }
      st_isvalidtrajectory: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_length: {
        Args:
          | { "": string }
          | { "": unknown }
          | { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_length2d: {
        Args: { "": unknown }
        Returns: number
      }
      st_letters: {
        Args: { font?: Json; letters: string }
        Returns: unknown
      }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefrommultipoint: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_linefromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_linefromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linemerge: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_linestringfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_linetocurve: {
        Args: { geometry: unknown }
        Returns: unknown
      }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_m: {
        Args: { "": unknown }
        Returns: number
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { "": unknown[] } | { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makepolygon: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { "": unknown } | { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_maximuminscribedcircle: {
        Args: { "": unknown }
        Returns: Record<string, unknown>
      }
      st_memsize: {
        Args: { "": unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_minimumboundingradius: {
        Args: { "": unknown }
        Returns: Record<string, unknown>
      }
      st_minimumclearance: {
        Args: { "": unknown }
        Returns: number
      }
      st_minimumclearanceline: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_mlinefromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_mlinefromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_mpointfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_mpointfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_mpolyfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_mpolyfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_multi: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_multilinefromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_multilinestringfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_multipointfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_multipointfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_multipolyfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_multipolygonfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_ndims: {
        Args: { "": unknown }
        Returns: number
      }
      st_node: {
        Args: { g: unknown }
        Returns: unknown
      }
      st_normalize: {
        Args: { geom: unknown }
        Returns: unknown
      }
      st_npoints: {
        Args: { "": unknown }
        Returns: number
      }
      st_nrings: {
        Args: { "": unknown }
        Returns: number
      }
      st_numgeometries: {
        Args: { "": unknown }
        Returns: number
      }
      st_numinteriorring: {
        Args: { "": unknown }
        Returns: number
      }
      st_numinteriorrings: {
        Args: { "": unknown }
        Returns: number
      }
      st_numpatches: {
        Args: { "": unknown }
        Returns: number
      }
      st_numpoints: {
        Args: { "": unknown }
        Returns: number
      }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_orientedenvelope: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { "": unknown } | { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_perimeter2d: {
        Args: { "": unknown }
        Returns: number
      }
      st_pointfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_pointfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointonsurface: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_points: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_polyfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_polygonfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_polygonfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_polygonize: {
        Args: { "": unknown[] }
        Returns: unknown
      }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: string
      }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_reverse: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid: {
        Args: { geog: unknown; srid: number } | { geom: unknown; srid: number }
        Returns: unknown
      }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shiftlongitude: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid: {
        Args: { geog: unknown } | { geom: unknown }
        Returns: number
      }
      st_startpoint: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_summary: {
        Args: { "": unknown } | { "": unknown }
        Returns: string
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_transform: {
        Args:
          | { from_proj: string; geom: unknown; to_proj: string }
          | { from_proj: string; geom: unknown; to_srid: number }
          | { geom: unknown; to_proj: string }
        Returns: unknown
      }
      st_triangulatepolygon: {
        Args: { g1: unknown }
        Returns: unknown
      }
      st_union: {
        Args:
          | { "": unknown[] }
          | { geom1: unknown; geom2: unknown }
          | { geom1: unknown; geom2: unknown; gridsize: number }
        Returns: unknown
      }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_wkbtosql: {
        Args: { wkb: string }
        Returns: unknown
      }
      st_wkttosql: {
        Args: { "": string }
        Returns: unknown
      }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      st_x: {
        Args: { "": unknown }
        Returns: number
      }
      st_xmax: {
        Args: { "": unknown }
        Returns: number
      }
      st_xmin: {
        Args: { "": unknown }
        Returns: number
      }
      st_y: {
        Args: { "": unknown }
        Returns: number
      }
      st_ymax: {
        Args: { "": unknown }
        Returns: number
      }
      st_ymin: {
        Args: { "": unknown }
        Returns: number
      }
      st_z: {
        Args: { "": unknown }
        Returns: number
      }
      st_zmax: {
        Args: { "": unknown }
        Returns: number
      }
      st_zmflag: {
        Args: { "": unknown }
        Returns: number
      }
      st_zmin: {
        Args: { "": unknown }
        Returns: number
      }
      text: {
        Args: { "": unknown }
        Returns: string
      }
      trigger_manual_maintenance: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      unlockrows: {
        Args: { "": string }
        Returns: number
      }
      update_forecast_table_stats: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      intel_post_tag:
        | "parking"
        | "hazard"
        | "crowd"
        | "conditions"
        | "access"
        | "other"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown | null
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      intel_post_tag: [
        "parking",
        "hazard",
        "crowd",
        "conditions",
        "access",
        "other",
      ],
    },
  },
} as const
