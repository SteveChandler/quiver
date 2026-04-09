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
      account_deletions: {
        Row: {
          comments_anonymized: number
          completed_at: string | null
          error: string | null
          id: string
          personal_rows_deleted: number
          requested_at: string
          sessions_soft_deleted: number
          user_id: string
        }
        Insert: {
          comments_anonymized?: number
          completed_at?: string | null
          error?: string | null
          id?: string
          personal_rows_deleted?: number
          requested_at?: string
          sessions_soft_deleted?: number
          user_id: string
        }
        Update: {
          comments_anonymized?: number
          completed_at?: string | null
          error?: string | null
          id?: string
          personal_rows_deleted?: number
          requested_at?: string
          sessions_soft_deleted?: number
          user_id?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          payload_summary: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          payload_summary?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          payload_summary?: Json | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_log_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_deliveries: {
        Row: {
          alert_date: string
          channel: string
          created_at: string
          id: string
          payload: Json
          sent_at: string
          user_id: string
        }
        Insert: {
          alert_date: string
          channel: string
          created_at?: string
          id?: string
          payload?: Json
          sent_at?: string
          user_id: string
        }
        Update: {
          alert_date?: string
          channel?: string
          created_at?: string
          id?: string
          payload?: Json
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      alert_queue: {
        Row: {
          alert_date: string
          beach_id: string
          best_hour: string
          conditions_snapshot: Json
          created_at: string
          id: string
          rule_id: string
          send_at: string
          sent: boolean
          user_id: string
          window_end: string
          window_start: string
        }
        Insert: {
          alert_date: string
          beach_id: string
          best_hour: string
          conditions_snapshot?: Json
          created_at?: string
          id?: string
          rule_id: string
          send_at: string
          sent?: boolean
          user_id: string
          window_end: string
          window_start: string
        }
        Update: {
          alert_date?: string
          beach_id?: string
          best_hour?: string
          conditions_snapshot?: Json
          created_at?: string
          id?: string
          rule_id?: string
          send_at?: string
          sent?: boolean
          user_id?: string
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_queue_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_queue_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "alert_queue_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_queue_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "alert_queue_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "alert_queue_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "alert_queue_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "alert_queue_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "alert_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_rules: {
        Row: {
          beach_id: string
          conditions: Json
          created_at: string
          enabled: boolean
          id: string
          last_matched_at: string | null
          name: string
          notify_email: boolean
          notify_push: boolean
          preset_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          beach_id: string
          conditions?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          last_matched_at?: string | null
          name: string
          notify_email?: boolean
          notify_push?: boolean
          preset_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          beach_id?: string
          conditions?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          last_matched_at?: string | null
          name?: string
          notify_email?: boolean
          notify_push?: boolean
          preset_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_rules_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "alert_rules_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_rules_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "alert_rules_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "alert_rules_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "alert_rules_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
        ]
      }
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
      beach_amenity_sources: {
        Row: {
          beach_id: string
          ccc_location_id: string
          created_at: string
          distance_m: number
          id: string
        }
        Insert: {
          beach_id: string
          ccc_location_id: string
          created_at?: string
          distance_m: number
          id?: string
        }
        Update: {
          beach_id?: string
          ccc_location_id?: string
          created_at?: string
          distance_m?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beach_amenity_sources_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_amenity_sources_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_amenity_sources_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_amenity_sources_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_amenity_sources_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_amenity_sources_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_amenity_sources_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_amenity_sources_ccc_location_id_fkey"
            columns: ["ccc_location_id"]
            isOneToOne: false
            referencedRelation: "ccc_access_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      beach_daily_intel: {
        Row: {
          beach_id: string
          best_window_description: string | null
          best_window_end: string | null
          best_window_start: string | null
          conditions_score: number | null
          confidence: string
          created_at: string
          forecast_date: string
          generated_at: string
          generation_time: string
          id: string
          next_tide_height_ft: number | null
          next_tide_time: string | null
          next_tide_type: string | null
          primary_swell_direction_deg: number | null
          primary_swell_direction_text: string | null
          primary_swell_height_ft: number | null
          primary_swell_period_s: number | null
          raw_intel_data: Json | null
          recommendation: string | null
          secondary_swell_direction_deg: number | null
          secondary_swell_direction_text: string | null
          secondary_swell_height_ft: number | null
          secondary_swell_period_s: number | null
          surf_description: string | null
          surf_max_ft: number | null
          surf_min_ft: number | null
          tide_height_ft: number | null
          tide_optimal_range: string | null
          tide_status: string | null
          tide_time: string | null
          updated_at: string
          wind_description: string | null
          wind_direction_deg: number | null
          wind_direction_text: string | null
          wind_quality: string | null
          wind_speed_mph: number | null
        }
        Insert: {
          beach_id: string
          best_window_description?: string | null
          best_window_end?: string | null
          best_window_start?: string | null
          conditions_score?: number | null
          confidence: string
          created_at?: string
          forecast_date: string
          generated_at?: string
          generation_time: string
          id?: string
          next_tide_height_ft?: number | null
          next_tide_time?: string | null
          next_tide_type?: string | null
          primary_swell_direction_deg?: number | null
          primary_swell_direction_text?: string | null
          primary_swell_height_ft?: number | null
          primary_swell_period_s?: number | null
          raw_intel_data?: Json | null
          recommendation?: string | null
          secondary_swell_direction_deg?: number | null
          secondary_swell_direction_text?: string | null
          secondary_swell_height_ft?: number | null
          secondary_swell_period_s?: number | null
          surf_description?: string | null
          surf_max_ft?: number | null
          surf_min_ft?: number | null
          tide_height_ft?: number | null
          tide_optimal_range?: string | null
          tide_status?: string | null
          tide_time?: string | null
          updated_at?: string
          wind_description?: string | null
          wind_direction_deg?: number | null
          wind_direction_text?: string | null
          wind_quality?: string | null
          wind_speed_mph?: number | null
        }
        Update: {
          beach_id?: string
          best_window_description?: string | null
          best_window_end?: string | null
          best_window_start?: string | null
          conditions_score?: number | null
          confidence?: string
          created_at?: string
          forecast_date?: string
          generated_at?: string
          generation_time?: string
          id?: string
          next_tide_height_ft?: number | null
          next_tide_time?: string | null
          next_tide_type?: string | null
          primary_swell_direction_deg?: number | null
          primary_swell_direction_text?: string | null
          primary_swell_height_ft?: number | null
          primary_swell_period_s?: number | null
          raw_intel_data?: Json | null
          recommendation?: string | null
          secondary_swell_direction_deg?: number | null
          secondary_swell_direction_text?: string | null
          secondary_swell_height_ft?: number | null
          secondary_swell_period_s?: number | null
          surf_description?: string | null
          surf_max_ft?: number | null
          surf_min_ft?: number | null
          tide_height_ft?: number | null
          tide_optimal_range?: string | null
          tide_status?: string | null
          tide_time?: string | null
          updated_at?: string
          wind_description?: string | null
          wind_direction_deg?: number | null
          wind_direction_text?: string | null
          wind_quality?: string | null
          wind_speed_mph?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "beach_daily_intel_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_daily_intel_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_daily_intel_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_daily_intel_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_daily_intel_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_daily_intel_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_daily_intel_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
        ]
      }
      beach_dioramas: {
        Row: {
          beach_id: string
          condition_key: string
          created_at: string | null
          id: string
          thumbnail_url: string | null
          video_url: string
        }
        Insert: {
          beach_id: string
          condition_key: string
          created_at?: string | null
          id?: string
          thumbnail_url?: string | null
          video_url: string
        }
        Update: {
          beach_id?: string
          condition_key?: string
          created_at?: string | null
          id?: string
          thumbnail_url?: string | null
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "beach_dioramas_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_dioramas_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_dioramas_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_dioramas_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_dioramas_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_dioramas_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_dioramas_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
        ]
      }
      beach_editorial_content: {
        Row: {
          beach_id: string
          content: Json
          content_type: string
          created_at: string
          generated_at: string
          id: string
          updated_at: string
        }
        Insert: {
          beach_id: string
          content: Json
          content_type: string
          created_at?: string
          generated_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          beach_id?: string
          content?: Json
          content_type?: string
          created_at?: string
          generated_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "beach_editorial_content_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_editorial_content_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_editorial_content_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_editorial_content_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_editorial_content_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_editorial_content_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_editorial_content_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
        ]
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
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_forecast_accuracy_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_forecast_accuracy_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_forecast_accuracy_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_forecast_accuracy_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_forecast_accuracy_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_forecast_accuracy_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
        ]
      }
      beach_photos: {
        Row: {
          approved: boolean
          attribution_html: string | null
          beach_id: string
          creator_name: string | null
          creator_url: string | null
          deleted_at: string | null
          fetched_at: string
          id: string
          image_url: string
          license_code: string | null
          license_url: string | null
          source: string
          source_id: string
          thumb_url: string | null
          title: string | null
        }
        Insert: {
          approved?: boolean
          attribution_html?: string | null
          beach_id: string
          creator_name?: string | null
          creator_url?: string | null
          deleted_at?: string | null
          fetched_at?: string
          id?: string
          image_url: string
          license_code?: string | null
          license_url?: string | null
          source: string
          source_id: string
          thumb_url?: string | null
          title?: string | null
        }
        Update: {
          approved?: boolean
          attribution_html?: string | null
          beach_id?: string
          creator_name?: string | null
          creator_url?: string | null
          deleted_at?: string | null
          fetched_at?: string
          id?: string
          image_url?: string
          license_code?: string | null
          license_url?: string | null
          source?: string
          source_id?: string
          thumb_url?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beach_photos_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_photos_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_photos_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_photos_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_photos_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_photos_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_photos_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
        ]
      }
      beach_photos_history: {
        Row: {
          approved: boolean | null
          attribution_html: string | null
          beach_id: string | null
          change_type: string
          changed_at: string
          changed_by: string | null
          creator_name: string | null
          creator_url: string | null
          deleted_at: string | null
          fetched_at: string | null
          history_id: string
          id: string
          image_url: string | null
          license_code: string | null
          license_url: string | null
          source: string | null
          source_id: string | null
          thumb_url: string | null
          title: string | null
        }
        Insert: {
          approved?: boolean | null
          attribution_html?: string | null
          beach_id?: string | null
          change_type: string
          changed_at?: string
          changed_by?: string | null
          creator_name?: string | null
          creator_url?: string | null
          deleted_at?: string | null
          fetched_at?: string | null
          history_id?: string
          id: string
          image_url?: string | null
          license_code?: string | null
          license_url?: string | null
          source?: string | null
          source_id?: string | null
          thumb_url?: string | null
          title?: string | null
        }
        Update: {
          approved?: boolean | null
          attribution_html?: string | null
          beach_id?: string | null
          change_type?: string
          changed_at?: string
          changed_by?: string | null
          creator_name?: string | null
          creator_url?: string | null
          deleted_at?: string | null
          fetched_at?: string | null
          history_id?: string
          id?: string
          image_url?: string | null
          license_code?: string | null
          license_url?: string | null
          source?: string | null
          source_id?: string | null
          thumb_url?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beach_photos_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_photos_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
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
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_recommendation_calibration_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_recommendation_calibration_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_recommendation_calibration_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_recommendation_calibration_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_recommendation_calibration_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_recommendation_calibration_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
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
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_reviews_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_reviews_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_reviews_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_reviews_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_reviews_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_reviews_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
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
      beach_reviews_history: {
        Row: {
          accessibility_rating: number | null
          beach_id: string | null
          change_type: string
          changed_at: string
          changed_by: string | null
          content: string | null
          created_at: string | null
          crowd_density_rating: number | null
          deleted_at: string | null
          helpful_count: number | null
          history_id: string
          id: string
          overall_rating: number | null
          parking_rating: number | null
          title: string | null
          updated_at: string | null
          user_id: string | null
          visit_date: string | null
          wave_quality_rating: number | null
        }
        Insert: {
          accessibility_rating?: number | null
          beach_id?: string | null
          change_type: string
          changed_at?: string
          changed_by?: string | null
          content?: string | null
          created_at?: string | null
          crowd_density_rating?: number | null
          deleted_at?: string | null
          helpful_count?: number | null
          history_id?: string
          id: string
          overall_rating?: number | null
          parking_rating?: number | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          visit_date?: string | null
          wave_quality_rating?: number | null
        }
        Update: {
          accessibility_rating?: number | null
          beach_id?: string | null
          change_type?: string
          changed_at?: string
          changed_by?: string | null
          content?: string | null
          created_at?: string | null
          crowd_density_rating?: number | null
          deleted_at?: string | null
          helpful_count?: number | null
          history_id?: string
          id?: string
          overall_rating?: number | null
          parking_rating?: number | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          visit_date?: string | null
          wave_quality_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "beach_reviews_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_reviews_history_changed_by_fkey"
            columns: ["changed_by"]
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
          thumbnail_url: string | null
          youtube_channel_handle: string | null
          youtube_channel_id: string | null
          youtube_last_resolved_at: string | null
          youtube_stream_title_hint: string | null
        }
        Insert: {
          beach_id: string
          camera_url?: string | null
          created_at?: string
          forecast_source_id?: string | null
          ndbc_buoy_ids?: string[]
          thumbnail_url?: string | null
          youtube_channel_handle?: string | null
          youtube_channel_id?: string | null
          youtube_last_resolved_at?: string | null
          youtube_stream_title_hint?: string | null
        }
        Update: {
          beach_id?: string
          camera_url?: string | null
          created_at?: string
          forecast_source_id?: string | null
          ndbc_buoy_ids?: string[]
          thumbnail_url?: string | null
          youtube_channel_handle?: string | null
          youtube_channel_id?: string | null
          youtube_last_resolved_at?: string | null
          youtube_stream_title_hint?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beach_sources_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_sources_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_sources_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_sources_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_sources_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_sources_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_sources_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
        ]
      }
      beach_water_quality: {
        Row: {
          beach_id: string
          exceedance_count_30d: number
          id: string
          latest_enterococcus: number | null
          latest_fecal_coliform: number | null
          latest_sample_date: string | null
          monitoring_station_id: string | null
          previous_status: string | null
          status: string
          status_changed_at: string | null
          status_reason: string | null
          total_samples_30d: number
          updated_at: string
        }
        Insert: {
          beach_id: string
          exceedance_count_30d?: number
          id?: string
          latest_enterococcus?: number | null
          latest_fecal_coliform?: number | null
          latest_sample_date?: string | null
          monitoring_station_id?: string | null
          previous_status?: string | null
          status?: string
          status_changed_at?: string | null
          status_reason?: string | null
          total_samples_30d?: number
          updated_at?: string
        }
        Update: {
          beach_id?: string
          exceedance_count_30d?: number
          id?: string
          latest_enterococcus?: number | null
          latest_fecal_coliform?: number | null
          latest_sample_date?: string | null
          monitoring_station_id?: string | null
          previous_status?: string | null
          status?: string
          status_changed_at?: string | null
          status_reason?: string | null
          total_samples_30d?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "beach_water_quality_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_water_quality_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_water_quality_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_water_quality_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_water_quality_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_water_quality_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_water_quality_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_water_quality_monitoring_station_id_fkey"
            columns: ["monitoring_station_id"]
            isOneToOne: false
            referencedRelation: "wq_monitoring_stations"
            referencedColumns: ["id"]
          },
        ]
      }
      beaches: {
        Row: {
          access_tips: string | null
          aspect_deg: number | null
          average_rating: number | null
          best_conditions_prose: string | null
          best_months: number[] | null
          break_type: string | null
          cdip_eligible: boolean
          cdip_station: string | null
          city: string | null
          country: string | null
          created_at: string
          crowd_level: string | null
          crowd_tips: string | null
          deleted_at: string | null
          description: string | null
          features: string[] | null
          geog: unknown
          hazards: string[] | null
          id: string
          is_private: boolean
          lat: number
          local_etiquette: string | null
          lon: number
          name: string
          owner_id: string | null
          parking_tips: string | null
          preference_model: Json | null
          preferred_tide_direction: string | null
          preferred_tide_ft_max: number | null
          preferred_tide_ft_min: number | null
          real_takeaways: string[] | null
          region: string | null
          review_count: number | null
          shoaling_factors: Json | null
          skill_level: string | null
          slug: string | null
          state: string | null
          swell_access_factors: number[] | null
          swell_analyzed_at: string | null
          swell_window_center_deg: number | null
          swell_window_halfwidth_deg: number | null
          swell_window_max_deg: number | null
          swell_window_min_deg: number | null
          terrain_analysis_debug: Json | null
          terrain_analyzed_at: string | null
          terrain_enabled: boolean
          terrain_method: string | null
          terrain_params: Json | null
          terrain_params_hash: string | null
          terrain_status: string | null
          tide_direction_sensitivity: string | null
          timezone: string | null
          warnings: string[] | null
          wave_tips: string | null
          wind_analyzed_at: string | null
          wind_cross_shore_ok_kt: number | null
          wind_exposure_factors: number[] | null
          wind_offshore_deg: number | null
          wind_offshore_tol_deg: number | null
          wind_onshore_bad_kt: number | null
        }
        Insert: {
          access_tips?: string | null
          aspect_deg?: number | null
          average_rating?: number | null
          best_conditions_prose?: string | null
          best_months?: number[] | null
          break_type?: string | null
          cdip_eligible?: boolean
          cdip_station?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          crowd_level?: string | null
          crowd_tips?: string | null
          deleted_at?: string | null
          description?: string | null
          features?: string[] | null
          geog?: unknown
          hazards?: string[] | null
          id?: string
          is_private?: boolean
          lat: number
          local_etiquette?: string | null
          lon: number
          name: string
          owner_id?: string | null
          parking_tips?: string | null
          preference_model?: Json | null
          preferred_tide_direction?: string | null
          preferred_tide_ft_max?: number | null
          preferred_tide_ft_min?: number | null
          real_takeaways?: string[] | null
          region?: string | null
          review_count?: number | null
          shoaling_factors?: Json | null
          skill_level?: string | null
          slug?: string | null
          state?: string | null
          swell_access_factors?: number[] | null
          swell_analyzed_at?: string | null
          swell_window_center_deg?: number | null
          swell_window_halfwidth_deg?: number | null
          swell_window_max_deg?: number | null
          swell_window_min_deg?: number | null
          terrain_analysis_debug?: Json | null
          terrain_analyzed_at?: string | null
          terrain_enabled?: boolean
          terrain_method?: string | null
          terrain_params?: Json | null
          terrain_params_hash?: string | null
          terrain_status?: string | null
          tide_direction_sensitivity?: string | null
          timezone?: string | null
          warnings?: string[] | null
          wave_tips?: string | null
          wind_analyzed_at?: string | null
          wind_cross_shore_ok_kt?: number | null
          wind_exposure_factors?: number[] | null
          wind_offshore_deg?: number | null
          wind_offshore_tol_deg?: number | null
          wind_onshore_bad_kt?: number | null
        }
        Update: {
          access_tips?: string | null
          aspect_deg?: number | null
          average_rating?: number | null
          best_conditions_prose?: string | null
          best_months?: number[] | null
          break_type?: string | null
          cdip_eligible?: boolean
          cdip_station?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          crowd_level?: string | null
          crowd_tips?: string | null
          deleted_at?: string | null
          description?: string | null
          features?: string[] | null
          geog?: unknown
          hazards?: string[] | null
          id?: string
          is_private?: boolean
          lat?: number
          local_etiquette?: string | null
          lon?: number
          name?: string
          owner_id?: string | null
          parking_tips?: string | null
          preference_model?: Json | null
          preferred_tide_direction?: string | null
          preferred_tide_ft_max?: number | null
          preferred_tide_ft_min?: number | null
          real_takeaways?: string[] | null
          region?: string | null
          review_count?: number | null
          shoaling_factors?: Json | null
          skill_level?: string | null
          slug?: string | null
          state?: string | null
          swell_access_factors?: number[] | null
          swell_analyzed_at?: string | null
          swell_window_center_deg?: number | null
          swell_window_halfwidth_deg?: number | null
          swell_window_max_deg?: number | null
          swell_window_min_deg?: number | null
          terrain_analysis_debug?: Json | null
          terrain_analyzed_at?: string | null
          terrain_enabled?: boolean
          terrain_method?: string | null
          terrain_params?: Json | null
          terrain_params_hash?: string | null
          terrain_status?: string | null
          tide_direction_sensitivity?: string | null
          timezone?: string | null
          warnings?: string[] | null
          wave_tips?: string | null
          wind_analyzed_at?: string | null
          wind_cross_shore_ok_kt?: number | null
          wind_exposure_factors?: number[] | null
          wind_offshore_deg?: number | null
          wind_offshore_tol_deg?: number | null
          wind_onshore_bad_kt?: number | null
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
          coordinates: unknown
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
          coordinates?: unknown
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
          coordinates?: unknown
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
      ccc_access_locations: {
        Row: {
          ccc_id: number
          county: string | null
          geog: unknown
          has_ada_access: boolean
          has_bike_path: boolean
          has_bluff_trail: boolean
          has_boating: boolean
          has_campground: boolean
          has_dog_friendly: boolean
          has_fee: boolean
          has_fishing: boolean
          has_parking: boolean
          has_picnic_area: boolean
          has_restrooms: boolean
          has_rocky_shore: boolean
          has_sandy_beach: boolean
          has_stroller_friendly: boolean
          has_tidepools: boolean
          has_visitor_center: boolean
          has_volleyball: boolean
          has_wildlife_viewing: boolean
          id: string
          lat: number
          lon: number
          name: string
          raw_data: Json | null
          synced_at: string
        }
        Insert: {
          ccc_id: number
          county?: string | null
          geog?: unknown
          has_ada_access?: boolean
          has_bike_path?: boolean
          has_bluff_trail?: boolean
          has_boating?: boolean
          has_campground?: boolean
          has_dog_friendly?: boolean
          has_fee?: boolean
          has_fishing?: boolean
          has_parking?: boolean
          has_picnic_area?: boolean
          has_restrooms?: boolean
          has_rocky_shore?: boolean
          has_sandy_beach?: boolean
          has_stroller_friendly?: boolean
          has_tidepools?: boolean
          has_visitor_center?: boolean
          has_volleyball?: boolean
          has_wildlife_viewing?: boolean
          id?: string
          lat: number
          lon: number
          name: string
          raw_data?: Json | null
          synced_at?: string
        }
        Update: {
          ccc_id?: number
          county?: string | null
          geog?: unknown
          has_ada_access?: boolean
          has_bike_path?: boolean
          has_bluff_trail?: boolean
          has_boating?: boolean
          has_campground?: boolean
          has_dog_friendly?: boolean
          has_fee?: boolean
          has_fishing?: boolean
          has_parking?: boolean
          has_picnic_area?: boolean
          has_restrooms?: boolean
          has_rocky_shore?: boolean
          has_sandy_beach?: boolean
          has_stroller_friendly?: boolean
          has_tidepools?: boolean
          has_visitor_center?: boolean
          has_volleyball?: boolean
          has_wildlife_viewing?: boolean
          id?: string
          lat?: number
          lon?: number
          name?: string
          raw_data?: Json | null
          synced_at?: string
        }
        Relationships: []
      }
      city_editorial_content: {
        Row: {
          city_name: string
          city_slug: string
          country_slug: string
          created_at: string
          description: string[]
          featured_intents: string[]
          id: string
          intent: string | null
          planning_checklist: string[]
          quick_links: Json
          region_label: string
          session_timing: Json
          state_slug: string
          updated_at: string
        }
        Insert: {
          city_name: string
          city_slug: string
          country_slug?: string
          created_at?: string
          description?: string[]
          featured_intents?: string[]
          id?: string
          intent?: string | null
          planning_checklist?: string[]
          quick_links?: Json
          region_label: string
          session_timing?: Json
          state_slug?: string
          updated_at?: string
        }
        Update: {
          city_name?: string
          city_slug?: string
          country_slug?: string
          created_at?: string
          description?: string[]
          featured_intents?: string[]
          id?: string
          intent?: string | null
          planning_checklist?: string[]
          quick_links?: Json
          region_label?: string
          session_timing?: Json
          state_slug?: string
          updated_at?: string
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
      corrected_forecasts: {
        Row: {
          beach_id: string
          bias_applied_m: number | null
          corrected_at: string | null
          corrected_height_m: number | null
          forecast_ts: string
          id: string
          model_version: string
          raw_height_m: number | null
          valid_time_utc: string
        }
        Insert: {
          beach_id: string
          bias_applied_m?: number | null
          corrected_at?: string | null
          corrected_height_m?: number | null
          forecast_ts: string
          id?: string
          model_version: string
          raw_height_m?: number | null
          valid_time_utc: string
        }
        Update: {
          beach_id?: string
          bias_applied_m?: number | null
          corrected_at?: string | null
          corrected_height_m?: number | null
          forecast_ts?: string
          id?: string
          model_version?: string
          raw_height_m?: number | null
          valid_time_utc?: string
        }
        Relationships: [
          {
            foreignKeyName: "corrected_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrected_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "corrected_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrected_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "corrected_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "corrected_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "corrected_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
        ]
      }
      data_cleanup_audit: {
        Row: {
          backup_data: Json | null
          cleanup_date: string
          cleanup_reason: string
          created_at: string
          id: string
          records_affected: number
          table_name: string
        }
        Insert: {
          backup_data?: Json | null
          cleanup_date?: string
          cleanup_reason: string
          created_at?: string
          id?: string
          records_affected: number
          table_name: string
        }
        Update: {
          backup_data?: Json | null
          cleanup_date?: string
          cleanup_reason?: string
          created_at?: string
          id?: string
          records_affected?: number
          table_name?: string
        }
        Relationships: []
      }
      dev_notes_queue: {
        Row: {
          created_at: string
          id: string
          polished_text: string | null
          posted: boolean
          posted_at: string | null
          posting_log_id: string | null
          raw_text: string
        }
        Insert: {
          created_at?: string
          id?: string
          polished_text?: string | null
          posted?: boolean
          posted_at?: string | null
          posting_log_id?: string | null
          raw_text: string
        }
        Update: {
          created_at?: string
          id?: string
          polished_text?: string | null
          posted?: boolean
          posted_at?: string | null
          posting_log_id?: string | null
          raw_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "dev_notes_queue_posting_log_id_fkey"
            columns: ["posting_log_id"]
            isOneToOne: false
            referencedRelation: "posting_log"
            referencedColumns: ["id"]
          },
        ]
      }
      digest_run_stats: {
        Row: {
          created_at: string
          duration_ms: number | null
          eligible_users: number
          emails_sent: number
          emails_sent_quick: number
          id: string
          push_failed: number
          push_no_tokens: number
          push_sent: number
          run_completed_at: string | null
          run_started_at: string
          skipped: Json
          status: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          eligible_users?: number
          emails_sent?: number
          emails_sent_quick?: number
          id?: string
          push_failed?: number
          push_no_tokens?: number
          push_sent?: number
          run_completed_at?: string | null
          run_started_at: string
          skipped?: Json
          status?: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          eligible_users?: number
          emails_sent?: number
          emails_sent_quick?: number
          id?: string
          push_failed?: number
          push_no_tokens?: number
          push_sent?: number
          run_completed_at?: string | null
          run_started_at?: string
          skipped?: Json
          status?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          best_beach_id: string | null
          best_score: number | null
          bounced_at: string | null
          clicked_at: string | null
          delivered_at: string | null
          email_type: string
          id: number
          local_date: string
          meta: Json
          opened_at: string | null
          resend_message_id: string | null
          sent_at: string
          subject: string
          user_id: string
        }
        Insert: {
          best_beach_id?: string | null
          best_score?: number | null
          bounced_at?: string | null
          clicked_at?: string | null
          delivered_at?: string | null
          email_type: string
          id?: number
          local_date: string
          meta?: Json
          opened_at?: string | null
          resend_message_id?: string | null
          sent_at?: string
          subject: string
          user_id: string
        }
        Update: {
          best_beach_id?: string | null
          best_score?: number | null
          bounced_at?: string | null
          clicked_at?: string | null
          delivered_at?: string | null
          email_type?: string
          id?: number
          local_date?: string
          meta?: Json
          opened_at?: string | null
          resend_message_id?: string | null
          sent_at?: string
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_send_log_best_beach_id_fkey"
            columns: ["best_beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_send_log_best_beach_id_fkey"
            columns: ["best_beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "email_send_log_best_beach_id_fkey"
            columns: ["best_beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_send_log_best_beach_id_fkey"
            columns: ["best_beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "email_send_log_best_beach_id_fkey"
            columns: ["best_beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "email_send_log_best_beach_id_fkey"
            columns: ["best_beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "email_send_log_best_beach_id_fkey"
            columns: ["best_beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
        ]
      }
      email_suppression_list: {
        Row: {
          email: string
          id: number
          notes: string | null
          reason: string
          suppressed_at: string
        }
        Insert: {
          email: string
          id?: number
          notes?: string | null
          reason: string
          suppressed_at?: string
        }
        Update: {
          email?: string
          id?: number
          notes?: string | null
          reason?: string
          suppressed_at?: string
        }
        Relationships: []
      }
      embed_impressions: {
        Row: {
          beach_slug: string
          created_at: string
          expires_at: string
          id: string
          referrer_domain: string | null
          widget_type: string
        }
        Insert: {
          beach_slug: string
          created_at?: string
          expires_at?: string
          id?: string
          referrer_domain?: string | null
          widget_type: string
        }
        Update: {
          beach_slug?: string
          created_at?: string
          expires_at?: string
          id?: string
          referrer_domain?: string | null
          widget_type?: string
        }
        Relationships: []
      }
      enhanced_forecasts: {
        Row: {
          air_temperature: string | null
          beach_id: string
          confidence_score: number
          coops_station_id: string | null
          created_at: string
          data_source: string | null
          forecast_at: string
          forecast_date: string
          forecast_time: string
          id: string
          next_tide_at: string | null
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
          wind_direction_deg: number | null
          wind_source: string | null
          wind_speed: string | null
          wind_wave_direction: string | null
          wind_wave_height: string | null
          wind_wave_period: string | null
        }
        Insert: {
          air_temperature?: string | null
          beach_id: string
          confidence_score?: number
          coops_station_id?: string | null
          created_at?: string
          data_source?: string | null
          forecast_at: string
          forecast_date: string
          forecast_time: string
          id?: string
          next_tide_at?: string | null
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
          wind_direction_deg?: number | null
          wind_source?: string | null
          wind_speed?: string | null
          wind_wave_direction?: string | null
          wind_wave_height?: string | null
          wind_wave_period?: string | null
        }
        Update: {
          air_temperature?: string | null
          beach_id?: string
          confidence_score?: number
          coops_station_id?: string | null
          created_at?: string
          data_source?: string | null
          forecast_at?: string
          forecast_date?: string
          forecast_time?: string
          id?: string
          next_tide_at?: string | null
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
          wind_direction_deg?: number | null
          wind_source?: string | null
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
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enhanced_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "enhanced_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enhanced_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "enhanced_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "enhanced_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "enhanced_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
        ]
      }
      fallback_events: {
        Row: {
          context: Json | null
          created_at: string
          domain: string
          fallback_value: string | null
          field: string
          id: number
          reason: string | null
          severity: string
        }
        Insert: {
          context?: Json | null
          created_at?: string
          domain: string
          fallback_value?: string | null
          field: string
          id?: never
          reason?: string | null
          severity: string
        }
        Update: {
          context?: Json | null
          created_at?: string
          domain?: string
          fallback_value?: string | null
          field?: string
          id?: never
          reason?: string | null
          severity?: string
        }
        Relationships: []
      }
      favorite_beaches: {
        Row: {
          alerts_enabled: boolean
          beach_id: string
          created_at: string | null
          id: string
          rank: number | null
          user_id: string
        }
        Insert: {
          alerts_enabled?: boolean
          beach_id: string
          created_at?: string | null
          id?: string
          rank?: number | null
          user_id: string
        }
        Update: {
          alerts_enabled?: boolean
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
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_beaches_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "favorite_beaches_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_beaches_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "favorite_beaches_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "favorite_beaches_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "favorite_beaches_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
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
      forecast_accuracy_votes: {
        Row: {
          actual_conditions: Json | null
          beach_id: string
          created_at: string
          forecast_id: string
          id: string
          notes: string | null
          photo_url: string | null
          updated_at: string
          user_id: string
          was_accurate: boolean
        }
        Insert: {
          actual_conditions?: Json | null
          beach_id: string
          created_at?: string
          forecast_id: string
          id?: string
          notes?: string | null
          photo_url?: string | null
          updated_at?: string
          user_id: string
          was_accurate: boolean
        }
        Update: {
          actual_conditions?: Json | null
          beach_id?: string
          created_at?: string
          forecast_id?: string
          id?: string
          notes?: string | null
          photo_url?: string | null
          updated_at?: string
          user_id?: string
          was_accurate?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "forecast_accuracy_votes_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forecast_accuracy_votes_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "forecast_accuracy_votes_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forecast_accuracy_votes_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "forecast_accuracy_votes_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "forecast_accuracy_votes_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "forecast_accuracy_votes_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "forecast_accuracy_votes_forecast_id_fkey"
            columns: ["forecast_id"]
            isOneToOne: false
            referencedRelation: "enhanced_forecasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forecast_accuracy_votes_forecast_id_fkey"
            columns: ["forecast_id"]
            isOneToOne: false
            referencedRelation: "ten_day_enhanced_forecasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forecast_accuracy_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forecast_accuracy_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_alert_deliveries: {
        Row: {
          alert_type: string
          beach_id: string
          created_at: string
          id: string
          last_matching_forecast_ts: string | null
          last_sent_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_type: string
          beach_id: string
          created_at?: string
          id?: string
          last_matching_forecast_ts?: string | null
          last_sent_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_type?: string
          beach_id?: string
          created_at?: string
          id?: string
          last_matching_forecast_ts?: string | null
          last_sent_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forecast_alert_deliveries_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forecast_alert_deliveries_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "forecast_alert_deliveries_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forecast_alert_deliveries_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "forecast_alert_deliveries_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "forecast_alert_deliveries_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "forecast_alert_deliveries_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
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
          confirmed_count: number
          created_at: string
          dedupe_hash: string | null
          description: string
          emoji_rating: string | null
          expires_at: string | null
          helpful_count: number
          id: string
          is_active: boolean
          latitude: number
          longitude: number
          off_count: number
          photo_storage_path: string | null
          photo_url: string | null
          report_count: number
          surf_conditions: Json | null
          tag: Database["public"]["Enums"]["intel_post_tag"]
          title: string
          updated_at: string
          user_id: string
          vibe: string | null
          wave_size_range: string | null
        }
        Insert: {
          beach_id?: string | null
          confirmations_count?: number
          confirmed_count?: number
          created_at?: string
          dedupe_hash?: string | null
          description: string
          emoji_rating?: string | null
          expires_at?: string | null
          helpful_count?: number
          id?: string
          is_active?: boolean
          latitude: number
          longitude: number
          off_count?: number
          photo_storage_path?: string | null
          photo_url?: string | null
          report_count?: number
          surf_conditions?: Json | null
          tag: Database["public"]["Enums"]["intel_post_tag"]
          title: string
          updated_at?: string
          user_id: string
          vibe?: string | null
          wave_size_range?: string | null
        }
        Update: {
          beach_id?: string | null
          confirmations_count?: number
          confirmed_count?: number
          created_at?: string
          dedupe_hash?: string | null
          description?: string
          emoji_rating?: string | null
          expires_at?: string | null
          helpful_count?: number
          id?: string
          is_active?: boolean
          latitude?: number
          longitude?: number
          off_count?: number
          photo_storage_path?: string | null
          photo_url?: string | null
          report_count?: number
          surf_conditions?: Json | null
          tag?: Database["public"]["Enums"]["intel_post_tag"]
          title?: string
          updated_at?: string
          user_id?: string
          vibe?: string | null
          wave_size_range?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intel_posts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_posts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "intel_posts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_posts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "intel_posts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "intel_posts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "intel_posts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
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
      intel_reports: {
        Row: {
          created_at: string
          id: string
          intel_post_id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          intel_post_id: string
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          intel_post_id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intel_reports_intel_post_id_fkey"
            columns: ["intel_post_id"]
            isOneToOne: false
            referencedRelation: "intel_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      intel_votes: {
        Row: {
          created_at: string
          id: string
          intel_post_id: string
          user_id: string
          vote_type: Database["public"]["Enums"]["intel_vote_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          intel_post_id: string
          user_id: string
          vote_type: Database["public"]["Enums"]["intel_vote_type"]
        }
        Update: {
          created_at?: string
          id?: string
          intel_post_id?: string
          user_id?: string
          vote_type?: Database["public"]["Enums"]["intel_vote_type"]
        }
        Relationships: [
          {
            foreignKeyName: "intel_votes_intel_post_id_fkey"
            columns: ["intel_post_id"]
            isOneToOne: false
            referencedRelation: "intel_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
        ]
      }
      ioos_observations: {
        Row: {
          created_at: string | null
          id: number
          observed_at: string
          raw_data: Json | null
          source: string
          station_id: string | null
          water_temp_c: number | null
          wave_direction_deg: number | null
          wave_height_m: number | null
          wave_period_s: number | null
          wind_direction_deg: number | null
          wind_speed_ms: number | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          observed_at: string
          raw_data?: Json | null
          source?: string
          station_id?: string | null
          water_temp_c?: number | null
          wave_direction_deg?: number | null
          wave_height_m?: number | null
          wave_period_s?: number | null
          wind_direction_deg?: number | null
          wind_speed_ms?: number | null
        }
        Update: {
          created_at?: string | null
          id?: number
          observed_at?: string
          raw_data?: Json | null
          source?: string
          station_id?: string | null
          water_temp_c?: number | null
          wave_direction_deg?: number | null
          wave_height_m?: number | null
          wave_period_s?: number | null
          wind_direction_deg?: number | null
          wind_speed_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ioos_observations_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "ioos_stations"
            referencedColumns: ["station_id"]
          },
        ]
      }
      ioos_stations: {
        Row: {
          active: boolean | null
          available_variables: Json
          consecutive_discovery_misses: number
          coordinates: unknown
          created_at: string | null
          distance_to_beach_km: number | null
          has_wave_data: boolean | null
          last_seen_at: string | null
          latitude: number
          longitude: number
          name: string | null
          nearest_beach_id: string | null
          sensors: Json | null
          source_network: string
          station_id: string
          updated_at: string | null
          variable_map: Json
          variables_last_synced_at: string | null
        }
        Insert: {
          active?: boolean | null
          available_variables?: Json
          consecutive_discovery_misses?: number
          coordinates?: unknown
          created_at?: string | null
          distance_to_beach_km?: number | null
          has_wave_data?: boolean | null
          last_seen_at?: string | null
          latitude: number
          longitude: number
          name?: string | null
          nearest_beach_id?: string | null
          sensors?: Json | null
          source_network: string
          station_id: string
          updated_at?: string | null
          variable_map?: Json
          variables_last_synced_at?: string | null
        }
        Update: {
          active?: boolean | null
          available_variables?: Json
          consecutive_discovery_misses?: number
          coordinates?: unknown
          created_at?: string | null
          distance_to_beach_km?: number | null
          has_wave_data?: boolean | null
          last_seen_at?: string | null
          latitude?: number
          longitude?: number
          name?: string | null
          nearest_beach_id?: string | null
          sensors?: Json | null
          source_network?: string
          station_id?: string
          updated_at?: string | null
          variable_map?: Json
          variables_last_synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ioos_stations_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ioos_stations_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "ioos_stations_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ioos_stations_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "ioos_stations_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "ioos_stations_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "ioos_stations_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
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
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marine_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "marine_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marine_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "marine_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "marine_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "marine_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
        ]
      }
      ml_model_registry: {
        Row: {
          created_at: string
          deployed_at: string | null
          holdout_corrected_mae: number | null
          holdout_improvement_pct: number | null
          holdout_raw_mae: number | null
          id: string
          notes: string | null
          production_improvement_pct: number | null
          status: string
          training_completed_at: string | null
          training_diagnostics: Json | null
          training_samples: number
          training_started_at: string | null
          training_window_days: number
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          deployed_at?: string | null
          holdout_corrected_mae?: number | null
          holdout_improvement_pct?: number | null
          holdout_raw_mae?: number | null
          id?: string
          notes?: string | null
          production_improvement_pct?: number | null
          status?: string
          training_completed_at?: string | null
          training_diagnostics?: Json | null
          training_samples: number
          training_started_at?: string | null
          training_window_days: number
          updated_at?: string
          version: string
        }
        Update: {
          created_at?: string
          deployed_at?: string | null
          holdout_corrected_mae?: number | null
          holdout_improvement_pct?: number | null
          holdout_raw_mae?: number | null
          id?: string
          notes?: string | null
          production_improvement_pct?: number | null
          status?: string
          training_completed_at?: string | null
          training_diagnostics?: Json | null
          training_samples?: number
          training_started_at?: string | null
          training_window_days?: number
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      ml_predictions_log: {
        Row: {
          beach_id: string
          bias_applied_m: number | null
          candidate_corrected_m: number | null
          candidate_model_version: string | null
          corrected_error_m: number | null
          corrected_forecast_m: number | null
          created_at: string | null
          forecast_horizon_hours: number | null
          id: string
          model_version: string
          observed_m: number | null
          predicted_at: string
          raw_error_m: number | null
          raw_forecast_m: number | null
          tide_height_m: number | null
          tide_state: string | null
          wave_direction_deg: number | null
          wave_period_s: number | null
          wind_direction_deg: number | null
          wind_speed_ms: number | null
        }
        Insert: {
          beach_id: string
          bias_applied_m?: number | null
          candidate_corrected_m?: number | null
          candidate_model_version?: string | null
          corrected_error_m?: number | null
          corrected_forecast_m?: number | null
          created_at?: string | null
          forecast_horizon_hours?: number | null
          id?: string
          model_version: string
          observed_m?: number | null
          predicted_at: string
          raw_error_m?: number | null
          raw_forecast_m?: number | null
          tide_height_m?: number | null
          tide_state?: string | null
          wave_direction_deg?: number | null
          wave_period_s?: number | null
          wind_direction_deg?: number | null
          wind_speed_ms?: number | null
        }
        Update: {
          beach_id?: string
          bias_applied_m?: number | null
          candidate_corrected_m?: number | null
          candidate_model_version?: string | null
          corrected_error_m?: number | null
          corrected_forecast_m?: number | null
          created_at?: string | null
          forecast_horizon_hours?: number | null
          id?: string
          model_version?: string
          observed_m?: number | null
          predicted_at?: string
          raw_error_m?: number | null
          raw_forecast_m?: number | null
          tide_height_m?: number | null
          tide_state?: string | null
          wave_direction_deg?: number | null
          wave_period_s?: number | null
          wind_direction_deg?: number | null
          wind_speed_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ml_predictions_log_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ml_predictions_log_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "ml_predictions_log_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ml_predictions_log_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "ml_predictions_log_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "ml_predictions_log_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "ml_predictions_log_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json
          id: string
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          id?: string
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      npc_content_templates: {
        Row: {
          archived: boolean | null
          content_type: string
          created_at: string | null
          id: string
          last_used_at: string | null
          personality: string
          tag: string | null
          template: string
          use_count: number | null
          variables: string[]
        }
        Insert: {
          archived?: boolean | null
          content_type: string
          created_at?: string | null
          id?: string
          last_used_at?: string | null
          personality: string
          tag?: string | null
          template: string
          use_count?: number | null
          variables: string[]
        }
        Update: {
          archived?: boolean | null
          content_type?: string
          created_at?: string | null
          id?: string
          last_used_at?: string | null
          personality?: string
          tag?: string | null
          template?: string
          use_count?: number | null
          variables?: string[]
        }
        Relationships: []
      }
      personalization_milestones: {
        Row: {
          achieved_at: string
          id: string
          metadata: Json | null
          milestone_key: string
          shown_at: string | null
          user_id: string
        }
        Insert: {
          achieved_at?: string
          id?: string
          metadata?: Json | null
          milestone_key: string
          shown_at?: string | null
          user_id: string
        }
        Update: {
          achieved_at?: string
          id?: string
          metadata?: Json | null
          milestone_key?: string
          shown_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      posting_config: {
        Row: {
          cadence_phase: string
          created_at: string
          enabled: boolean
          id: string
          last_posted_at: string | null
          post_type: string
        }
        Insert: {
          cadence_phase?: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_posted_at?: string | null
          post_type: string
        }
        Update: {
          cadence_phase?: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_posted_at?: string | null
          post_type?: string
        }
        Relationships: []
      }
      posting_log: {
        Row: {
          beaches_featured: string[] | null
          bluesky_uri: string | null
          content_text: string
          error_message: string | null
          id: string
          image_url: string | null
          post_type: string
          posted_at: string
          success: boolean
          template_index: number | null
        }
        Insert: {
          beaches_featured?: string[] | null
          bluesky_uri?: string | null
          content_text: string
          error_message?: string | null
          id?: string
          image_url?: string | null
          post_type: string
          posted_at?: string
          success?: boolean
          template_index?: number | null
        }
        Update: {
          beaches_featured?: string[] | null
          bluesky_uri?: string | null
          content_text?: string
          error_message?: string | null
          id?: string
          image_url?: string | null
          post_type?: string
          posted_at?: string
          success?: boolean
          template_index?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activity_level: string | null
          allow_implicit_tracking: boolean
          avatar_url: string | null
          bio: string | null
          created_at: string
          crowd_preference: string | null
          deleted_at: string | null
          digest_session_invites: boolean
          display_name: string | null
          email: string | null
          email_session_invites: boolean
          experience_level: string | null
          followers_count: number | null
          following_count: number | null
          full_name: string | null
          home_beach_id: string | null
          home_region: string | null
          id: string
          inapp_session_invites: boolean
          instagram: string | null
          is_admin: boolean
          is_mock: boolean
          is_system_account: boolean | null
          location: string | null
          notif_email_enabled: boolean
          notif_follows: boolean
          notif_forecast_alerts: boolean
          notif_inapp_enabled: boolean
          notif_likes: boolean
          notif_push_enabled: boolean
          notif_reminders: boolean
          notif_session_invites: boolean
          notif_water_quality: boolean
          notif_xp_updates: boolean
          onboarding_completed_at: string | null
          personality_type: string | null
          phone_number: string | null
          posting_window: Json | null
          preferences_v2_shown_at: string | null
          preferred_break_type: string | null
          preferred_session_time: string | null
          preferred_wave_size: string | null
          referral_code: string | null
          signup_context: Json | null
          signup_location: Json | null
          surf_styles: string[] | null
          timezone: string | null
          trust_score: number
          updated_at: string | null
        }
        Insert: {
          activity_level?: string | null
          allow_implicit_tracking?: boolean
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          crowd_preference?: string | null
          deleted_at?: string | null
          digest_session_invites?: boolean
          display_name?: string | null
          email?: string | null
          email_session_invites?: boolean
          experience_level?: string | null
          followers_count?: number | null
          following_count?: number | null
          full_name?: string | null
          home_beach_id?: string | null
          home_region?: string | null
          id?: string
          inapp_session_invites?: boolean
          instagram?: string | null
          is_admin?: boolean
          is_mock?: boolean
          is_system_account?: boolean | null
          location?: string | null
          notif_email_enabled?: boolean
          notif_follows?: boolean
          notif_forecast_alerts?: boolean
          notif_inapp_enabled?: boolean
          notif_likes?: boolean
          notif_push_enabled?: boolean
          notif_reminders?: boolean
          notif_session_invites?: boolean
          notif_water_quality?: boolean
          notif_xp_updates?: boolean
          onboarding_completed_at?: string | null
          personality_type?: string | null
          phone_number?: string | null
          posting_window?: Json | null
          preferences_v2_shown_at?: string | null
          preferred_break_type?: string | null
          preferred_session_time?: string | null
          preferred_wave_size?: string | null
          referral_code?: string | null
          signup_context?: Json | null
          signup_location?: Json | null
          surf_styles?: string[] | null
          timezone?: string | null
          trust_score?: number
          updated_at?: string | null
        }
        Update: {
          activity_level?: string | null
          allow_implicit_tracking?: boolean
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          crowd_preference?: string | null
          deleted_at?: string | null
          digest_session_invites?: boolean
          display_name?: string | null
          email?: string | null
          email_session_invites?: boolean
          experience_level?: string | null
          followers_count?: number | null
          following_count?: number | null
          full_name?: string | null
          home_beach_id?: string | null
          home_region?: string | null
          id?: string
          inapp_session_invites?: boolean
          instagram?: string | null
          is_admin?: boolean
          is_mock?: boolean
          is_system_account?: boolean | null
          location?: string | null
          notif_email_enabled?: boolean
          notif_follows?: boolean
          notif_forecast_alerts?: boolean
          notif_inapp_enabled?: boolean
          notif_likes?: boolean
          notif_push_enabled?: boolean
          notif_reminders?: boolean
          notif_session_invites?: boolean
          notif_water_quality?: boolean
          notif_xp_updates?: boolean
          onboarding_completed_at?: string | null
          personality_type?: string | null
          phone_number?: string | null
          posting_window?: Json | null
          preferences_v2_shown_at?: string | null
          preferred_break_type?: string | null
          preferred_session_time?: string | null
          preferred_wave_size?: string | null
          referral_code?: string | null
          signup_context?: Json | null
          signup_location?: Json | null
          surf_styles?: string[] | null
          timezone?: string | null
          trust_score?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_default_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "profiles_default_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_default_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "profiles_default_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "profiles_default_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "profiles_default_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "profiles_home_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_home_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "profiles_home_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_home_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "profiles_home_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "profiles_home_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "profiles_home_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
        ]
      }
      referrals: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          referee_id: string
          referral_code: string
          referrer_id: string
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          referee_id: string
          referral_code: string
          referrer_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          referee_id?: string
          referral_code?: string
          referrer_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: true
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_windows: {
        Row: {
          beach_id: string
          created_at: string
          end_ts: string
          id: number
          source: string
          start_ts: string
          user_id: string
        }
        Insert: {
          beach_id: string
          created_at?: string
          end_ts: string
          id?: number
          source?: string
          start_ts: string
          user_id: string
        }
        Update: {
          beach_id?: string
          created_at?: string
          end_ts?: string
          id?: number
          source?: string
          start_ts?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_windows_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_windows_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "saved_windows_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_windows_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "saved_windows_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "saved_windows_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "saved_windows_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
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
          forecast_vs_actual: Json | null
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
          forecast_vs_actual?: Json | null
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
          forecast_vs_actual?: Json | null
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
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_forecast_snapshots_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "session_forecast_snapshots_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_forecast_snapshots_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "session_forecast_snapshots_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "session_forecast_snapshots_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "session_forecast_snapshots_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
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
          seen_at: string | null
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
          seen_at?: string | null
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
          seen_at?: string | null
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_invitations_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_invitations_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_invitations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
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
      session_logs: {
        Row: {
          beach_id: string
          created_at: string
          id: number
          notes: string | null
          predicted_score: number | null
          rating: string
          source: string
          user_id: string
          window_end: string | null
          window_start: string
        }
        Insert: {
          beach_id: string
          created_at?: string
          id?: number
          notes?: string | null
          predicted_score?: number | null
          rating: string
          source?: string
          user_id: string
          window_end?: string | null
          window_start: string
        }
        Update: {
          beach_id?: string
          created_at?: string
          id?: number
          notes?: string | null
          predicted_score?: number | null
          rating?: string
          source?: string
          user_id?: string
          window_end?: string | null
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_logs_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_logs_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "session_logs_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_logs_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "session_logs_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "session_logs_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "session_logs_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
        ]
      }
      session_media: {
        Row: {
          caption: string | null
          created_at: string
          deleted_at: string | null
          file_size: number
          id: string
          media_type: string
          metadata: Json | null
          public_url: string
          session_id: string | null
          storage_path: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          deleted_at?: string | null
          file_size?: number
          id?: string
          media_type?: string
          metadata?: Json | null
          public_url: string
          session_id?: string | null
          storage_path: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          deleted_at?: string | null
          file_size?: number
          id?: string
          media_type?: string
          metadata?: Json | null
          public_url?: string
          session_id?: string | null
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_media_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_media_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_media_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
        ]
      }
      session_media_history: {
        Row: {
          caption: string | null
          change_type: string
          changed_at: string
          changed_by: string | null
          created_at: string | null
          deleted_at: string | null
          file_size: number | null
          history_id: string
          id: string
          media_type: string | null
          metadata: Json | null
          public_url: string | null
          session_id: string | null
          storage_path: string | null
          user_id: string | null
        }
        Insert: {
          caption?: string | null
          change_type: string
          changed_at?: string
          changed_by?: string | null
          created_at?: string | null
          deleted_at?: string | null
          file_size?: number | null
          history_id?: string
          id: string
          media_type?: string | null
          metadata?: Json | null
          public_url?: string | null
          session_id?: string | null
          storage_path?: string | null
          user_id?: string | null
        }
        Update: {
          caption?: string | null
          change_type?: string
          changed_at?: string
          changed_by?: string | null
          created_at?: string | null
          deleted_at?: string | null
          file_size?: number | null
          history_id?: string
          id?: string
          media_type?: string | null
          metadata?: Json | null
          public_url?: string | null
          session_id?: string | null
          storage_path?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_media_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_media_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
        ]
      }
      session_shares: {
        Row: {
          aspect_ratio: string | null
          created_at: string
          id: string
          platform: string
          session_id: string
          share_date: string
          share_url: string | null
          user_id: string
          variant: string | null
        }
        Insert: {
          aspect_ratio?: string | null
          created_at?: string
          id?: string
          platform: string
          session_id: string
          share_date?: string
          share_url?: string | null
          user_id: string
          variant?: string | null
        }
        Update: {
          aspect_ratio?: string | null
          created_at?: string
          id?: string
          platform?: string
          session_id?: string
          share_date?: string
          share_url?: string | null
          user_id?: string
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_shares_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_shares_user_id_fkey"
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
          board_snapshot: Json | null
          comments_count: number
          created_at: string
          crowd_level: number | null
          deleted_at: string | null
          description: string | null
          duration_minutes: number
          forecast_accuracy: string | null
          goals: string[]
          id: string
          image_url: string | null
          invitee_ids: string[]
          is_public: boolean | null
          likes_count: number
          muted: boolean | null
          notes: string | null
          parking_ease: number | null
          rating: number | null
          share_count: number
          skill_ratings: Json | null
          source: string | null
          status: string | null
          tide_height_ft: number | null
          tide_status: string | null
          user_id: string
          water_temp: number | null
          wave_height_ft: number | null
          wave_quality: number | null
          wind_direction: string | null
          wind_speed_mph: number | null
        }
        Insert: {
          arrival_time?: string
          beach_id: string
          beach_name?: string | null
          board_id?: string | null
          board_snapshot?: Json | null
          comments_count?: number
          created_at?: string
          crowd_level?: number | null
          deleted_at?: string | null
          description?: string | null
          duration_minutes?: number
          forecast_accuracy?: string | null
          goals?: string[]
          id?: string
          image_url?: string | null
          invitee_ids?: string[]
          is_public?: boolean | null
          likes_count?: number
          muted?: boolean | null
          notes?: string | null
          parking_ease?: number | null
          rating?: number | null
          share_count?: number
          skill_ratings?: Json | null
          source?: string | null
          status?: string | null
          tide_height_ft?: number | null
          tide_status?: string | null
          user_id: string
          water_temp?: number | null
          wave_height_ft?: number | null
          wave_quality?: number | null
          wind_direction?: string | null
          wind_speed_mph?: number | null
        }
        Update: {
          arrival_time?: string
          beach_id?: string
          beach_name?: string | null
          board_id?: string | null
          board_snapshot?: Json | null
          comments_count?: number
          created_at?: string
          crowd_level?: number | null
          deleted_at?: string | null
          description?: string | null
          duration_minutes?: number
          forecast_accuracy?: string | null
          goals?: string[]
          id?: string
          image_url?: string | null
          invitee_ids?: string[]
          is_public?: boolean | null
          likes_count?: number
          muted?: boolean | null
          notes?: string | null
          parking_ease?: number | null
          rating?: number | null
          share_count?: number
          skill_ratings?: Json | null
          source?: string | null
          status?: string | null
          tide_height_ft?: number | null
          tide_status?: string | null
          user_id?: string
          water_temp?: number | null
          wave_height_ft?: number | null
          wave_quality?: number | null
          wind_direction?: string | null
          wind_speed_mph?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "sessions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "sessions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "sessions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "sessions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "sessions_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_user_id_profiles_fkey"
            columns: ["user_id"]
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
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spot_feedback_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "spot_feedback_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spot_feedback_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "spot_feedback_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "spot_feedback_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "spot_feedback_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
        ]
      }
      storage_bucket_docs: {
        Row: {
          allowed_types: string[] | null
          bucket_name: string
          deletion_policy: string
          max_file_size: string | null
          notes: string | null
          path_pattern: string
          public_access: boolean
          purpose: string
        }
        Insert: {
          allowed_types?: string[] | null
          bucket_name: string
          deletion_policy: string
          max_file_size?: string | null
          notes?: string | null
          path_pattern: string
          public_access?: boolean
          purpose: string
        }
        Update: {
          allowed_types?: string[] | null
          bucket_name?: string
          deletion_policy?: string
          max_file_size?: string | null
          notes?: string | null
          path_pattern?: string
          public_access?: boolean
          purpose?: string
        }
        Relationships: []
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
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sun_times_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "sun_times_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sun_times_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "sun_times_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "sun_times_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "sun_times_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
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
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tide_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "tide_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tide_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "tide_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "tide_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "tide_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
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
      user_beach_affinity: {
        Row: {
          affinity_score: number
          beach_id: string
          computed_at: string | null
          id: string
          last_surfed_at: string | null
          session_count: number
          user_id: string
        }
        Insert: {
          affinity_score?: number
          beach_id: string
          computed_at?: string | null
          id?: string
          last_surfed_at?: string | null
          session_count?: number
          user_id: string
        }
        Update: {
          affinity_score?: number
          beach_id?: string
          computed_at?: string | null
          id?: string
          last_surfed_at?: string | null
          session_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_beach_affinity_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_beach_affinity_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "user_beach_affinity_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_beach_affinity_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "user_beach_affinity_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "user_beach_affinity_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "user_beach_affinity_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
        ]
      }
      user_devices: {
        Row: {
          created_at: string
          device_token: string
          id: string
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_token: string
          id?: string
          platform: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_token?: string
          id?: string
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_email_prefs: {
        Row: {
          created_at: string
          email_frequency: string
          home_beach_id: string | null
          min_good_score: number
          pref_time_bucket: string
          skill_level: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_frequency?: string
          home_beach_id?: string | null
          min_good_score?: number
          pref_time_bucket?: string
          skill_level?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_frequency?: string
          home_beach_id?: string | null
          min_good_score?: number
          pref_time_bucket?: string
          skill_level?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_email_prefs_home_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_email_prefs_home_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "user_email_prefs_home_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_email_prefs_home_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "user_email_prefs_home_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "user_email_prefs_home_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "user_email_prefs_home_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
        ]
      }
      user_events: {
        Row: {
          beach_id: string | null
          bot_flagged: boolean | null
          created_at: string
          event_type: string
          expires_at: string
          id: string
          metadata: Json
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          beach_id?: string | null
          bot_flagged?: boolean | null
          created_at?: string
          event_type: string
          expires_at?: string
          id?: string
          metadata?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          beach_id?: string | null
          bot_flagged?: boolean | null
          created_at?: string
          event_type?: string
          expires_at?: string
          id?: string
          metadata?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_events_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_events_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "user_events_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_events_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "user_events_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "user_events_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "user_events_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
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
      user_implicit_preferences: {
        Row: {
          break_type_weights: Json
          computed_from: string
          computed_to: string
          confidence: number
          event_count: number
          inferred_wave_max_ft: number | null
          inferred_wave_min_ft: number | null
          last_computed_at: string
          location_centroid_lat: number | null
          location_centroid_lon: number | null
          time_slot_weights: Json
          top_engaged_beach_ids: string[] | null
          typical_travel_radius_miles: number | null
          user_id: string
        }
        Insert: {
          break_type_weights?: Json
          computed_from?: string
          computed_to?: string
          confidence?: number
          event_count?: number
          inferred_wave_max_ft?: number | null
          inferred_wave_min_ft?: number | null
          last_computed_at?: string
          location_centroid_lat?: number | null
          location_centroid_lon?: number | null
          time_slot_weights?: Json
          top_engaged_beach_ids?: string[] | null
          typical_travel_radius_miles?: number | null
          user_id: string
        }
        Update: {
          break_type_weights?: Json
          computed_from?: string
          computed_to?: string
          confidence?: number
          event_count?: number
          inferred_wave_max_ft?: number | null
          inferred_wave_min_ft?: number | null
          last_computed_at?: string
          location_centroid_lat?: number | null
          location_centroid_lon?: number | null
          time_slot_weights?: Json
          top_engaged_beach_ids?: string[] | null
          typical_travel_radius_miles?: number | null
          user_id?: string
        }
        Relationships: []
      }
      user_surf_preferences: {
        Row: {
          confidence: number
          created_at: string | null
          id: string
          last_computed_at: string | null
          manual_override: boolean | null
          max_wind_mph: number | null
          preferred_tide_statuses: string[] | null
          preferred_wind_directions: number[] | null
          sample_size: number
          updated_at: string | null
          user_id: string
          validated_at: string | null
          wave_max_ft: number | null
          wave_min_ft: number | null
          wave_period_max_s: number | null
          wave_period_min_s: number | null
        }
        Insert: {
          confidence?: number
          created_at?: string | null
          id?: string
          last_computed_at?: string | null
          manual_override?: boolean | null
          max_wind_mph?: number | null
          preferred_tide_statuses?: string[] | null
          preferred_wind_directions?: number[] | null
          sample_size?: number
          updated_at?: string | null
          user_id: string
          validated_at?: string | null
          wave_max_ft?: number | null
          wave_min_ft?: number | null
          wave_period_max_s?: number | null
          wave_period_min_s?: number | null
        }
        Update: {
          confidence?: number
          created_at?: string | null
          id?: string
          last_computed_at?: string | null
          manual_override?: boolean | null
          max_wind_mph?: number | null
          preferred_tide_statuses?: string[] | null
          preferred_wind_directions?: number[] | null
          sample_size?: number
          updated_at?: string | null
          user_id?: string
          validated_at?: string | null
          wave_max_ft?: number | null
          wave_min_ft?: number | null
          wave_period_max_s?: number | null
          wave_period_min_s?: number | null
        }
        Relationships: []
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
      wq_monitoring_stations: {
        Row: {
          active: boolean
          county: string | null
          distance_to_beach_m: number | null
          geog: unknown
          id: string
          last_sample_at: string | null
          lat: number
          lon: number
          name: string
          nearest_beach_id: string | null
          org_id: string | null
          org_name: string | null
          state: string | null
          station_id: string
          synced_at: string
        }
        Insert: {
          active?: boolean
          county?: string | null
          distance_to_beach_m?: number | null
          geog?: unknown
          id?: string
          last_sample_at?: string | null
          lat: number
          lon: number
          name: string
          nearest_beach_id?: string | null
          org_id?: string | null
          org_name?: string | null
          state?: string | null
          station_id: string
          synced_at?: string
        }
        Update: {
          active?: boolean
          county?: string | null
          distance_to_beach_m?: number | null
          geog?: unknown
          id?: string
          last_sample_at?: string | null
          lat?: number
          lon?: number
          name?: string
          nearest_beach_id?: string | null
          org_id?: string | null
          org_name?: string | null
          state?: string | null
          station_id?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wq_monitoring_stations_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wq_monitoring_stations_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "wq_monitoring_stations_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wq_monitoring_stations_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "wq_monitoring_stations_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "wq_monitoring_stations_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "wq_monitoring_stations_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
        ]
      }
      wq_samples: {
        Row: {
          characteristic: string
          created_at: string | null
          detection_condition: string | null
          id: string
          raw_data: Json | null
          sample_date: string
          station_id: string
          unit: string | null
          value: number | null
        }
        Insert: {
          characteristic: string
          created_at?: string | null
          detection_condition?: string | null
          id?: string
          raw_data?: Json | null
          sample_date: string
          station_id: string
          unit?: string | null
          value?: number | null
        }
        Update: {
          characteristic?: string
          created_at?: string | null
          detection_condition?: string | null
          id?: string
          raw_data?: Json | null
          sample_date?: string
          station_id?: string
          unit?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wq_samples_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "wq_monitoring_stations"
            referencedColumns: ["id"]
          },
        ]
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
      beach_location_audit: {
        Row: {
          city: string | null
          country: string | null
          created_at: string | null
          id: string | null
          location_status: string | null
          name: string | null
          slug: string | null
          state: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          id?: string | null
          location_status?: never
          name?: string | null
          slug?: string | null
          state?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          id?: string | null
          location_status?: never
          name?: string | null
          slug?: string | null
          state?: string | null
        }
        Relationships: []
      }
      beach_location_audit_summary: {
        Row: {
          beach_count: number | null
          location_status: string | null
          percentage: number | null
        }
        Relationships: []
      }
      beach_ml_performance_baseline: {
        Row: {
          avg_corrected_bias: number | null
          avg_raw_bias: number | null
          beach_id: string | null
          beach_name: string | null
          corrected_mae: number | null
          improvement_rate_pct: number | null
          last_prediction_at: string | null
          mae_improvement_pct: number | null
          match_rate_pct: number | null
          period_end: string | null
          period_start: string | null
          predictions_matched: number | null
          predictions_total: number | null
          raw_mae: number | null
        }
        Relationships: []
      }
      beach_photos_featured: {
        Row: {
          attribution_html: string | null
          beach_id: string | null
          image_url: string | null
          thumb_url: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beach_photos_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_photos_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_photos_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_photos_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_photos_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_photos_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_photos_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
        ]
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      mv_beach_amenities: {
        Row: {
          beach_id: string | null
          has_ada_access: boolean | null
          has_bike_path: boolean | null
          has_bluff_trail: boolean | null
          has_boating: boolean | null
          has_campground: boolean | null
          has_dog_friendly: boolean | null
          has_fee: boolean | null
          has_fishing: boolean | null
          has_parking: boolean | null
          has_picnic_area: boolean | null
          has_restrooms: boolean | null
          has_rocky_shore: boolean | null
          has_sandy_beach: boolean | null
          has_stroller_friendly: boolean | null
          has_tidepools: boolean | null
          has_visitor_center: boolean | null
          has_volleyball: boolean | null
          has_wildlife_viewing: boolean | null
          nearest_source_m: number | null
          source_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "beach_amenity_sources_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_amenity_sources_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_amenity_sources_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_amenity_sources_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_amenity_sources_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_amenity_sources_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_amenity_sources_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
        ]
      }
      observable_beaches: {
        Row: {
          beach_id: string | null
        }
        Relationships: []
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
          onboarding_completed_at: string | null
          phone_number: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_default_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "profiles_default_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_default_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "profiles_default_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "profiles_default_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "profiles_default_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "profiles_home_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_home_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "profiles_home_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_home_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "profiles_home_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "profiles_home_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "profiles_home_beach_id_fkey"
            columns: ["home_beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
        ]
      }
      ten_day_enhanced_forecasts: {
        Row: {
          air_temperature: string | null
          beach_id: string | null
          confidence_score: number | null
          coops_station_id: string | null
          created_at: string | null
          data_source: string | null
          forecast_at: string | null
          forecast_date: string | null
          forecast_time: string | null
          id: string | null
          next_tide_at: string | null
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
          coops_station_id?: string | null
          created_at?: string | null
          data_source?: string | null
          forecast_at?: string | null
          forecast_date?: string | null
          forecast_time?: string | null
          id?: string | null
          next_tide_at?: string | null
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
          coops_station_id?: string | null
          created_at?: string | null
          data_source?: string | null
          forecast_at?: string | null
          forecast_date?: string | null
          forecast_time?: string | null
          id?: string | null
          next_tide_at?: string | null
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
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enhanced_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "enhanced_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enhanced_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "enhanced_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "enhanced_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "enhanced_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
        ]
      }
      unified_wave_observations: {
        Row: {
          distance_to_beach_km: number | null
          latitude: number | null
          longitude: number | null
          nearest_beach_id: string | null
          observed_at: string | null
          source: string | null
          source_network: string | null
          station_id: string | null
          water_temp_c: number | null
          wave_direction_deg: number | null
          wave_height_m: number | null
          wave_period_s: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ioos_observations_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "ioos_stations"
            referencedColumns: ["station_id"]
          },
          {
            foreignKeyName: "ioos_stations_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ioos_stations_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "ioos_stations_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ioos_stations_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "ioos_stations_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "ioos_stations_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "ioos_stations_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
        ]
      }
      v_enhanced_forecast_latest: {
        Row: {
          beach_id: string | null
          data_source: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      v_marine_forecast_latest: {
        Row: {
          beach_id: string | null
          created_at: string | null
          is_observed: boolean | null
          source: string | null
          ts: string | null
        }
        Relationships: []
      }
      v_sun_times_latest: {
        Row: {
          beach_id: string | null
          created_at: string | null
          date: string | null
          source: string | null
        }
        Relationships: []
      }
      v_tide_forecast_latest: {
        Row: {
          beach_id: string | null
          created_at: string | null
          source: string | null
          ts: string | null
        }
        Relationships: []
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
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
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
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
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
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
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
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      backfill_ml_observations: {
        Args: { batch_size?: number }
        Returns: {
          elapsed_ms: number
          matched: number
          no_match: number
          processed: number
        }[]
      }
      backfill_ml_observations_batch: {
        Args: { batch_size?: number }
        Returns: {
          elapsed_ms: number
          expired_deleted: number
          matched: number
          processed: number
          sentinel_marked: number
        }[]
      }
      check_database_health: {
        Args: never
        Returns: {
          last_analyzed: string
          row_count: number
          table_name: string
          table_size: string
        }[]
      }
      check_ml_drift: { Args: never; Returns: boolean }
      check_ml_ground_truth_health: {
        Args: never
        Returns: {
          message: string
          metric: string
          status: string
          value: number
        }[]
      }
      claim_forecast_delivery_slot: {
        Args: {
          p_alert_type: string
          p_beach_id: string
          p_dedupe_hours?: number
          p_user_id: string
        }
        Returns: boolean
      }
      cleanup_expired_events: { Args: never; Returns: number }
      cleanup_inactive_buoys: {
        Args: { inactive_days?: number }
        Returns: number
      }
      cleanup_old_beach_intel: { Args: never; Returns: undefined }
      cleanup_old_forecasts: {
        Args: { retention_days?: number }
        Returns: number
      }
      cleanup_old_ml_predictions: { Args: never; Returns: number }
      cleanup_orphaned_session_media: { Args: never; Returns: number }
      cleanup_session_media_storage: {
        Args: { media_id: string }
        Returns: {
          message: string
          storage_path: string
          success: boolean
        }[]
      }
      cleanup_stale_enhanced_forecasts: {
        Args: { retention_days?: number }
        Returns: number
      }
      compute_all_affinities_initial: { Args: never; Returns: undefined }
      compute_beach_affinity: {
        Args: { _beach_id: string; _user_id: string }
        Returns: number
      }
      compute_implicit_preferences: {
        Args: { target_user_id?: string }
        Returns: number
      }
      concat_text_array: { Args: { vals: string[] }; Returns: string }
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
      delete_user_account: { Args: { p_user_id: string }; Returns: Json }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      find_cities_by_pattern: {
        Args: { search_pattern: string; state_filter?: string }
        Returns: {
          beach_count: number
          city: string
          is_exact_match: boolean
          state: string
        }[]
      }
      find_nearby_ioos_stations: {
        Args: { p_lat: number; p_lon: number; p_radius_km?: number }
        Returns: {
          active: boolean | null
          available_variables: Json
          consecutive_discovery_misses: number
          coordinates: unknown
          created_at: string | null
          distance_to_beach_km: number | null
          has_wave_data: boolean | null
          last_seen_at: string | null
          latitude: number
          longitude: number
          name: string | null
          nearest_beach_id: string | null
          sensors: Json | null
          source_network: string
          station_id: string
          updated_at: string | null
          variable_map: Json
          variables_last_synced_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "ioos_stations"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      find_nearest_beach_id: {
        Args: {
          max_distance_meters?: number
          post_lat: number
          post_lon: number
        }
        Returns: string
      }
      find_orphaned_session_media: {
        Args: never
        Returns: {
          days_since_deletion: number
          deleted_at: string
          media_id: string
          storage_path: string
        }[]
      }
      generate_referral_code: { Args: never; Returns: string }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
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
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
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
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_all_beach_locations: {
        Args: never
        Returns: {
          beach_count: number
          city: string
          country: string
          state: string
        }[]
      }
      get_beach_ml_performance: {
        Args: { p_beach_id: string }
        Returns: {
          avg_corrected_bias: number
          avg_raw_bias: number
          beach_id: string
          beach_name: string
          corrected_mae: number
          improvement_rate_pct: number
          last_prediction_at: string
          mae_improvement_pct: number
          match_rate_pct: number
          period_end: string
          period_start: string
          predictions_matched: number
          predictions_total: number
          raw_mae: number
        }[]
      }
      get_beach_observation_station: {
        Args: { p_beach_id: string }
        Returns: string
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
      get_beaches_by_location_with_scores: {
        Args: { p_city: string; p_country?: string; p_state: string }
        Returns: {
          average_rating: number
          avg_confirmations: number
          best_conditions_prose: string
          break_type: string
          city: string
          composite_score: number
          country: string
          crowd_level: string
          description: string
          id: string
          lat: number
          lon: number
          name: string
          recent_intel_count: number
          review_count: number
          skill_level: string
          slug: string
          state: string
        }[]
      }
      get_beaches_by_metro_with_scores: {
        Args: { p_cities: string[]; p_country?: string; p_state: string }
        Returns: {
          average_rating: number
          avg_confirmations: number
          best_conditions_prose: string
          break_type: string
          city: string
          composite_score: number
          country: string
          crowd_level: string
          description: string
          id: string
          lat: number
          lon: number
          name: string
          recent_intel_count: number
          review_count: number
          skill_level: string
          slug: string
          state: string
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
          preferred_tide_ft_max: number
          preferred_tide_ft_min: number
          swell_window_center_deg: number
          swell_window_halfwidth_deg: number
          wind_cross_shore_ok_kt: number
          wind_offshore_deg: number
          wind_onshore_bad_kt: number
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
      get_bulk_current_forecasts: {
        Args: { p_beach_ids: string[]; p_target_date?: string }
        Returns: {
          beach_id: string
          forecast_date: string
          forecast_time: string
          wave_height: string
        }[]
      }
      get_cities_with_beach_skills: {
        Args: { min_beaches?: number }
        Returns: {
          beach_count: number
          city: string
          country: string
          has_advanced: boolean
          has_beginner: boolean
          has_editorial: boolean
          has_least_crowded: boolean
          state: string
        }[]
      }
      get_city_editorial: {
        Args: { p_city: string; p_country?: string; p_state?: string }
        Returns: {
          city_name: string
          city_slug: string
          country_slug: string
          created_at: string
          description: string[]
          featured_intents: string[]
          id: string
          intent: string | null
          planning_checklist: string[]
          quick_links: Json
          region_label: string
          session_timing: Json
          state_slug: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "city_editorial_content"
          isOneToOne: true
          isSetofReturn: false
        }
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
      get_conditions_alert_candidates:
        | {
            Args: { p_min_score?: number }
            Returns: {
              beach_city: string
              beach_name: string
              beach_slug: string
              beach_state: string
              best_window_end: string
              best_window_start: string
              conditions_score: number
              display_name: string
              email: string
              home_beach_id: string
              recommendation: string
              surf_description: string
              user_id: string
              wind_description: string
            }[]
          }
        | {
            Args: { p_cooldown_hours?: number; p_min_score?: number }
            Returns: {
              beach_name: string
              beach_slug: string
              best_window_end: string
              best_window_start: string
              conditions_score: number
              display_name: string
              email: string
              home_beach_id: string
              recommendation: string
              surf_description: string
              user_id: string
              wind_description: string
            }[]
          }
      get_conversion_funnel: {
        Args: { days?: number }
        Returns: {
          funnel_step: string
          step_order: number
          total_count: number
          unique_sessions: number
        }[]
      }
      get_current_production_model: {
        Args: never
        Returns: {
          deployed_at: string
          holdout_improvement_pct: number
          production_improvement_pct: number
          training_samples: number
          version: string
        }[]
      }
      get_entity_history: {
        Args: { entity_id: string; limit_rows?: number; table_name: string }
        Returns: {
          change_type: string
          changed_at: string
          changed_by: string
          history_id: string
          snapshot: Json
        }[]
      }
      get_forecast_vs_observation_pairs: {
        Args: { p_days_back?: number; p_max_distance_km?: number }
        Returns: {
          beach_id: string
          distance_km: number
          forecast_age_hours: number
          forecast_period: string
          forecast_wave_height: string
          observation_source: string
          observation_time: string
          observed_wave_height_m: number
          observed_wave_period_s: number
          station_id: string
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
      get_location_stats: {
        Args: { p_city: string; p_country?: string; p_state: string }
        Returns: {
          average_rating: number
          top_beaches: number
          total_beaches: number
          total_reviews: number
        }[]
      }
      get_metro_stats: {
        Args: { p_cities: string[]; p_country?: string; p_state: string }
        Returns: {
          average_rating: number
          cities_count: number
          top_beaches: number
          total_beaches: number
          total_reviews: number
        }[]
      }
      get_ml_health_metrics: {
        Args: never
        Returns: {
          avg_corrected_error_24h: number
          avg_raw_error_24h: number
          improvement_pct_24h: number
          match_rate_24h: number
          matched_last_24h: number
          observable_beaches_count: number
          oldest_pending_age_hours: number
          pending_12_24h: number
          pending_gt_24h: number
          pending_observations: number
          sentinel_marked: number
          total_observable_24h: number
          total_predictions: number
        }[]
      }
      get_ml_weekly_metrics: {
        Args: never
        Returns: {
          avg_corrected_error_m: number
          avg_improvement_m: number
          avg_raw_error_m: number
          model_version: string
          pct_improved: number
          predictions: number
          with_ground_truth: number
        }[]
      }
      get_most_visited_beach: {
        Args: { user_id: string }
        Returns: {
          beach_id: string
          beach_name: string
          visit_count: number
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
          break_type: string
          city: string
          distance_meters: number
          id: string
          is_private: boolean
          lat: number
          location: string
          lon: number
          name: string
          skill_level: string
          slug: string
          state: string
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
          confirmed_count: number
          created_at: string
          description: string
          distance_miles: number
          expires_at: string
          helpful_count: number
          id: string
          is_active: boolean
          latitude: number
          longitude: number
          off_count: number
          photo_url: string
          rank_score: number
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
      get_observations_for_beach: {
        Args: { p_beach_id: string; p_hours_back?: number }
        Returns: {
          distance_km: number
          observed_at: string
          source: string
          station_id: string
          water_temp_c: number
          wave_direction_deg: number
          wave_height_m: number
          wave_period_s: number
        }[]
      }
      get_profile_stats: { Args: { p_user_id: string }; Returns: Json }
      get_reengagement_email_candidates: {
        Args: {
          p_dedupe_hours?: number
          p_global_cooldown_hours?: number
          p_inactive_days?: number
          p_min_score?: number
        }
        Returns: {
          beach_name: string
          beach_slug: string
          best_window_end: string
          best_window_start: string
          conditions_score: number
          display_name: string
          email: string
          home_beach_id: string
          recommendation: string
          surf_description: string
          user_id: string
          wind_description: string
        }[]
      }
      get_referral_leaderboard: {
        Args: { max_results?: number }
        Returns: {
          avatar_url: string
          display_name: string
          rank: number
          referral_count: number
          user_id: string
        }[]
      }
      get_session_prompt_candidates:
        | {
            Args: { p_min_score?: number }
            Returns: {
              beach_name: string
              beach_slug: string
              conditions_score: number
              display_name: string
              email: string
              home_beach_id: string
              surf_description: string
              user_id: string
              wind_description: string
            }[]
          }
        | {
            Args: { p_cooldown_hours?: number; p_min_score?: number }
            Returns: {
              beach_name: string
              beach_slug: string
              conditions_score: number
              display_name: string
              email: string
              home_beach_id: string
              surf_description: string
              user_id: string
              wind_description: string
            }[]
          }
      get_session_share_stats: {
        Args: { p_session_id: string }
        Returns: {
          copy_shares: number
          facebook_shares: number
          instagram_shares: number
          last_shared_at: string
          tiktok_shares: number
          total_shares: number
          twitter_shares: number
          unique_sharers: number
        }[]
      }
      get_user_referral_stats: {
        Args: { user_id: string }
        Returns: {
          completed_referrals: number
          expired_referrals: number
          pending_referrals: number
          referral_code: string
          total_referrals: number
        }[]
      }
      get_user_storage_stats: {
        Args: { p_user_id: string }
        Returns: {
          image_count: number
          remaining_bytes: number
          total_bytes: number
          usage_percentage: number
        }[]
      }
      get_user_viral_coefficient: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_welcome_email_candidates: {
        Args: never
        Returns: {
          case_type: string
          created_at: string
          email: string
          email_confirmed_at: string
          home_beach_id: string
          user_id: string
        }[]
      }
      get_worst_performing_beaches: {
        Args: { limit_count?: number }
        Returns: {
          beach_id: string
          beach_name: string
          corrected_mae: number
          improvement_rate_pct: number
          mae_improvement_pct: number
          predictions_matched: number
          raw_mae: number
        }[]
      }
      get_yesterday_accuracy: {
        Args: { p_beach_id: string }
        Returns: {
          avg_observed_m: number
          avg_predicted_m: number
          beach_id: string
          forecast_date: string
          mae_m: number
          observation_count: number
          relative_error_pct: number
          should_display: boolean
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      increment_session_share_count: {
        Args: { session_id: string }
        Returns: undefined
      }
      increment_station_discovery_misses: {
        Args: { seen_ids: string[] }
        Returns: undefined
      }
      is_admin_user: { Args: never; Returns: boolean }
      link_anonymous_events: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: number
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      nightly_forecast_maintenance: { Args: never; Returns: Json }
      notify_session_invite: {
        Args: {
          p_actor_id: string
          p_payload?: Json
          p_recipient_id: string
          p_session_id: string
        }
        Returns: {
          activity_type: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_activities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
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
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      prune_forecasts_retention: {
        Args: {
          batch_size?: number
          keep_days_enhanced?: number
          keep_days_raw?: number
        }
        Returns: {
          enhanced_deleted: number
          marine_deleted: number
          tide_deleted: number
        }[]
      }
      purge_implicit_history: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      refresh_beach_ml_baseline: { Args: never; Returns: undefined }
      refresh_enhanced_forecasts_for_active_beaches: {
        Args: never
        Returns: Json
      }
      refresh_mv_beach_amenities: { Args: never; Returns: undefined }
      refresh_observable_beaches: { Args: never; Returns: undefined }
      restore_entity: {
        Args: { entity_id: string; table_name: string }
        Returns: boolean
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
      set_audit_triggers_enabled: {
        Args: { enabled: boolean }
        Returns: string
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      soft_delete_entity: {
        Args: { entity_id: string; table_name: string }
        Returns: boolean
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
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
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
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
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
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
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
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
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
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
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
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
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
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
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
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
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
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
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
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
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
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
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
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
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
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
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
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      swell_windows_overlap: {
        Args: { p_max1: number; p_max2: number; p_min1: number; p_min2: number }
        Returns: number
      }
      trigger_manual_maintenance: { Args: never; Returns: Json }
      unaccent: { Args: { "": string }; Returns: string }
      unlockrows: { Args: { "": string }; Returns: number }
      update_beach_coordinates: {
        Args: { p_beach_id: string; p_latitude: number; p_longitude: number }
        Returns: undefined
      }
      update_forecast_table_stats: { Args: never; Returns: undefined }
      update_user_storage_usage: {
        Args: {
          p_bytes_to_add: number
          p_images_to_add?: number
          p_user_id: string
        }
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
      intel_vote_type: "helpful" | "off" | "confirmed"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
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
      intel_vote_type: ["helpful", "off", "confirmed"],
    },
  },
} as const
