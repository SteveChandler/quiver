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
      _backup_beach_timezones_20260820: {
        Row: {
          captured_at: string
          city: string | null
          id: string
          lat: number | null
          lon: number | null
          name: string | null
          old_timezone: string
          state: string | null
        }
        Insert: {
          captured_at?: string
          city?: string | null
          id: string
          lat?: number | null
          lon?: number | null
          name?: string | null
          old_timezone: string
          state?: string | null
        }
        Update: {
          captured_at?: string
          city?: string | null
          id?: string
          lat?: number | null
          lon?: number | null
          name?: string | null
          old_timezone?: string
          state?: string | null
        }
        Relationships: []
      }
      _backup_beach_timezones_fl_20260820: {
        Row: {
          captured_at: string
          city: string | null
          id: string
          lat: number | null
          lon: number | null
          name: string | null
          old_timezone: string
          state: string | null
        }
        Insert: {
          captured_at?: string
          city?: string | null
          id: string
          lat?: number | null
          lon?: number | null
          name?: string | null
          old_timezone: string
          state?: string | null
        }
        Update: {
          captured_at?: string
          city?: string | null
          id?: string
          lat?: number | null
          lon?: number | null
          name?: string | null
          old_timezone?: string
          state?: string | null
        }
        Relationships: []
      }
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
      activation_push_log: {
        Row: {
          metadata: Json
          nudge_type: string
          sent_at: string
          user_id: string
        }
        Insert: {
          metadata?: Json
          nudge_type: string
          sent_at?: string
          user_id: string
        }
        Update: {
          metadata?: Json
          nudge_type?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activation_push_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
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
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
          },
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
          {
            foreignKeyName: "admin_audit_log_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
          },
        ]
      }
      alert_deliveries: {
        Row: {
          alert_date: string
          beach_id: string | null
          channel: string
          created_at: string
          id: string
          payload: Json
          sent_at: string
          user_id: string
        }
        Insert: {
          alert_date: string
          beach_id?: string | null
          channel: string
          created_at?: string
          id?: string
          payload?: Json
          sent_at?: string
          user_id: string
        }
        Update: {
          alert_date?: string
          beach_id?: string | null
          channel?: string
          created_at?: string
          id?: string
          payload?: Json
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_deliveries_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_deliveries_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "alert_deliveries_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_deliveries_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "alert_deliveries_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "alert_deliveries_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "alert_deliveries_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "alert_deliveries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      alert_delivery_attempts: {
        Row: {
          attempted_at: string
          channel: string
          id: string
          queue_id: string
          rule_id: string
          skip_reason: string | null
          status: string
          user_id: string
        }
        Insert: {
          attempted_at?: string
          channel: string
          id?: string
          queue_id: string
          rule_id: string
          skip_reason?: string | null
          status: string
          user_id: string
        }
        Update: {
          attempted_at?: string
          channel?: string
          id?: string
          queue_id?: string
          rule_id?: string
          skip_reason?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_delivery_attempts_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "alert_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_delivery_attempts_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "alert_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_delivery_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "alert_delivery_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_delivery_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_delivery_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
          },
        ]
      }
      alert_queue: {
        Row: {
          alert_date: string
          beach_id: string
          best_hour: string
          best_score: number
          conditions_snapshot: Json
          created_at: string
          delivery_shadow_outcome: Json | null
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
          best_score?: number
          conditions_snapshot?: Json
          created_at?: string
          delivery_shadow_outcome?: Json | null
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
          best_score?: number
          conditions_snapshot?: Json
          created_at?: string
          delivery_shadow_outcome?: Json | null
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
          {
            foreignKeyName: "alert_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      alert_rules: {
        Row: {
          auto_created_at: string | null
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
          auto_created_at?: string | null
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
          auto_created_at?: string | null
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
          {
            foreignKeyName: "alert_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      amenities: {
        Row: {
          amenity_type: string
          confidence: number
          geog: unknown
          id: string
          imported_at: string
          label: string | null
          lat: number
          lon: number
          raw: Json | null
          source: string
          source_ref: string | null
          verified_at: string | null
        }
        Insert: {
          amenity_type: string
          confidence?: number
          geog?: unknown
          id?: string
          imported_at?: string
          label?: string | null
          lat: number
          lon: number
          raw?: Json | null
          source: string
          source_ref?: string | null
          verified_at?: string | null
        }
        Update: {
          amenity_type?: string
          confidence?: number
          geog?: unknown
          id?: string
          imported_at?: string
          label?: string | null
          lat?: number
          lon?: number
          raw?: Json | null
          source?: string
          source_ref?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      android_beta_leads: {
        Row: {
          created_at: string
          email: string
          id: string
          instructions_sent_at: string | null
          placement: string
          session_id: string | null
          source: string
          surface: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          instructions_sent_at?: string | null
          placement: string
          session_id?: string | null
          source: string
          surface: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          instructions_sent_at?: string | null
          placement?: string
          session_id?: string | null
          source?: string
          surface?: string
        }
        Relationships: []
      }
      android_tester_roster_audit: {
        Row: {
          action: string
          actor_user_id: string | null
          entry_id: string | null
          evidence: Json
          id: number
          observed_at: string
          outcome: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          entry_id?: string | null
          evidence?: Json
          id?: never
          observed_at?: string
          outcome: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          entry_id?: string | null
          evidence?: Json
          id?: never
          observed_at?: string
          outcome?: string
        }
        Relationships: [
          {
            foreignKeyName: "android_tester_roster_audit_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "android_tester_roster_audit_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "android_tester_roster_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      android_tester_roster_entries: {
        Row: {
          created_at: string
          eligibility_confidence: string
          eligibility_observed_at: string
          eligibility_source: string
          eligibility_status: string
          group_membership_status: string
          id: string
          linked_at: string | null
          purge_after: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          eligibility_confidence?: string
          eligibility_observed_at: string
          eligibility_source?: string
          eligibility_status?: string
          group_membership_status?: string
          id?: string
          linked_at?: string | null
          purge_after?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          eligibility_confidence?: string
          eligibility_observed_at?: string
          eligibility_source?: string
          eligibility_status?: string
          group_membership_status?: string
          id?: string
          linked_at?: string | null
          purge_after?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "android_tester_roster_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      android_tester_roster_first_open_evidence: {
        Row: {
          entry_id: string
          id: string
          idempotency_key_hash: string
          native_install_id: string
          observed_at: string
          user_id: string
        }
        Insert: {
          entry_id: string
          id?: string
          idempotency_key_hash: string
          native_install_id: string
          observed_at?: string
          user_id: string
        }
        Update: {
          entry_id?: string
          id?: string
          idempotency_key_hash?: string
          native_install_id?: string
          observed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "android_tester_roster_first_open_evidence_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "android_tester_roster_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "android_tester_roster_first_open_evidence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      android_tester_roster_identities: {
        Row: {
          auth_tag: string
          ciphertext: string
          created_at: string
          entry_id: string
          iv: string
          key_version: number
          updated_at: string
        }
        Insert: {
          auth_tag: string
          ciphertext: string
          created_at?: string
          entry_id: string
          iv: string
          key_version: number
          updated_at?: string
        }
        Update: {
          auth_tag?: string
          ciphertext?: string
          created_at?: string
          entry_id?: string
          iv?: string
          key_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "android_tester_roster_identities_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: true
            referencedRelation: "android_tester_roster_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      android_tester_roster_install_evidence: {
        Row: {
          campaign: string
          created_on: string
          entry_id: string
          expires_on: string
          id: string
          idempotency_key_hash: string
          native_install_id: string
          observed_at: string
          placement: string
          source: string
          surface: string
          user_id: string
        }
        Insert: {
          campaign: string
          created_on: string
          entry_id: string
          expires_on: string
          id?: string
          idempotency_key_hash: string
          native_install_id: string
          observed_at?: string
          placement: string
          source: string
          surface: string
          user_id: string
        }
        Update: {
          campaign?: string
          created_on?: string
          entry_id?: string
          expires_on?: string
          id?: string
          idempotency_key_hash?: string
          native_install_id?: string
          observed_at?: string
          placement?: string
          source?: string
          surface?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "android_tester_roster_install_evidence_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "android_tester_roster_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "android_tester_roster_install_evidence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      android_tester_roster_join_evidence: {
        Row: {
          entry_id: string
          id: string
          idempotency_key_hash: string
          native_install_id: string
          observed_at: string
          user_id: string
        }
        Insert: {
          entry_id: string
          id?: string
          idempotency_key_hash: string
          native_install_id: string
          observed_at?: string
          user_id: string
        }
        Update: {
          entry_id?: string
          id?: string
          idempotency_key_hash?: string
          native_install_id?: string
          observed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "android_tester_roster_join_evidence_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "android_tester_roster_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "android_tester_roster_join_evidence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      android_tester_roster_stages: {
        Row: {
          confidence: string
          created_at: string
          entry_id: string
          evidence: Json
          id: number
          observed_at: string
          source: string
          stage: string
          status: string
        }
        Insert: {
          confidence: string
          created_at?: string
          entry_id: string
          evidence?: Json
          id?: never
          observed_at: string
          source: string
          stage: string
          status: string
        }
        Update: {
          confidence?: string
          created_at?: string
          entry_id?: string
          evidence?: Json
          id?: never
          observed_at?: string
          source?: string
          stage?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "android_tester_roster_stages_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "android_tester_roster_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      android_tester_roster_sync_claims: {
        Row: {
          claim_token: string
          claimed_at: string
          claimed_by: string | null
          singleton: boolean
        }
        Insert: {
          claim_token: string
          claimed_at: string
          claimed_by?: string | null
          singleton?: boolean
        }
        Update: {
          claim_token?: string
          claimed_at?: string
          claimed_by?: string | null
          singleton?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "android_tester_roster_sync_claims_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      android_tester_roster_sync_runs: {
        Row: {
          added_count: number
          complete: boolean
          created_at: string
          direct_user_count: number
          failure_code: string | null
          id: string
          left_count: number
          observed_at: string
          purged_count: number
          refreshed_count: number
          rejoined_count: number
          source: string
        }
        Insert: {
          added_count?: number
          complete: boolean
          created_at?: string
          direct_user_count?: number
          failure_code?: string | null
          id?: string
          left_count?: number
          observed_at: string
          purged_count?: number
          refreshed_count?: number
          rejoined_count?: number
          source: string
        }
        Update: {
          added_count?: number
          complete?: boolean
          created_at?: string
          direct_user_count?: number
          failure_code?: string | null
          id?: string
          left_count?: number
          observed_at?: string
          purged_count?: number
          refreshed_count?: number
          rejoined_count?: number
          source?: string
        }
        Relationships: []
      }
      android_waitlist_entries: {
        Row: {
          created_at: string
          first_joined_at: string
          id: string
          last_joined_at: string
          normalized_email_sha256: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          first_joined_at: string
          id?: string
          last_joined_at: string
          normalized_email_sha256?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          first_joined_at?: string
          id?: string
          last_joined_at?: string
          normalized_email_sha256?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "android_waitlist_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      android_waitlist_events: {
        Row: {
          created_at: string
          entry_id: string
          event_type: string
          id: string
          observed_at: string
          source_kind: string
        }
        Insert: {
          created_at?: string
          entry_id: string
          event_type: string
          id?: string
          observed_at: string
          source_kind: string
        }
        Update: {
          created_at?: string
          entry_id?: string
          event_type?: string
          id?: string
          observed_at?: string
          source_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "android_waitlist_events_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "android_waitlist_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      android_waitlist_source_links: {
        Row: {
          created_at: string
          entry_id: string
          first_observed_at: string
          id: string
          last_observed_at: string
          placement: string
          roster_entry_id: string | null
          source: string
          source_id: string
          source_kind: string
          surface: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entry_id: string
          first_observed_at: string
          id?: string
          last_observed_at: string
          placement: string
          roster_entry_id?: string | null
          source: string
          source_id: string
          source_kind: string
          surface: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entry_id?: string
          first_observed_at?: string
          id?: string
          last_observed_at?: string
          placement?: string
          roster_entry_id?: string | null
          source?: string
          source_id?: string
          source_kind?: string
          surface?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "android_waitlist_source_links_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "android_waitlist_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "android_waitlist_source_links_roster_entry_id_fkey"
            columns: ["roster_entry_id"]
            isOneToOne: false
            referencedRelation: "android_tester_roster_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      apple_identity_recovery_audit: {
        Row: {
          canonical_user_id: string
          created_at: string
          event_details: Json
          event_type: string
          id: number
          recovery_id: string | null
        }
        Insert: {
          canonical_user_id: string
          created_at?: string
          event_details?: Json
          event_type: string
          id?: never
          recovery_id?: string | null
        }
        Update: {
          canonical_user_id?: string
          created_at?: string
          event_details?: Json
          event_type?: string
          id?: never
          recovery_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apple_identity_recovery_audit_recovery_id_fkey"
            columns: ["recovery_id"]
            isOneToOne: false
            referencedRelation: "apple_identity_recovery_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      apple_identity_recovery_requests: {
        Row: {
          apple_identity_id: string
          apple_sub_sha256: string
          apple_token_sha256: string
          assessment_idempotency_key: string
          canonical_user_id: string
          completed_at: string | null
          confirmation_idempotency_key: string | null
          confirmed_at: string | null
          created_at: string
          eligibility_snapshot: Json
          expires_at: string
          id: string
          notification_status: string
          rollback_until: string | null
          secondary_user_id: string
          status: string
          support_reference: string
          updated_at: string
        }
        Insert: {
          apple_identity_id: string
          apple_sub_sha256: string
          apple_token_sha256: string
          assessment_idempotency_key: string
          canonical_user_id: string
          completed_at?: string | null
          confirmation_idempotency_key?: string | null
          confirmed_at?: string | null
          created_at?: string
          eligibility_snapshot: Json
          expires_at: string
          id?: string
          notification_status?: string
          rollback_until?: string | null
          secondary_user_id: string
          status: string
          support_reference: string
          updated_at?: string
        }
        Update: {
          apple_identity_id?: string
          apple_sub_sha256?: string
          apple_token_sha256?: string
          assessment_idempotency_key?: string
          canonical_user_id?: string
          completed_at?: string | null
          confirmation_idempotency_key?: string | null
          confirmed_at?: string | null
          created_at?: string
          eligibility_snapshot?: Json
          expires_at?: string
          id?: string
          notification_status?: string
          rollback_until?: string | null
          secondary_user_id?: string
          status?: string
          support_reference?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "apple_identity_recovery_requests_canonical_user_id_fkey"
            columns: ["canonical_user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "apple_identity_recovery_requests_secondary_user_id_fkey"
            columns: ["secondary_user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      apple_recovery_dependency_registry: {
        Row: {
          constraint_name: string
          registered_at: string
          source_columns: string[]
          source_schema: string
          source_table: string
          target_schema: string
          target_table: string
        }
        Insert: {
          constraint_name: string
          registered_at?: string
          source_columns: string[]
          source_schema: string
          source_table: string
          target_schema: string
          target_table: string
        }
        Update: {
          constraint_name?: string
          registered_at?: string
          source_columns?: string[]
          source_schema?: string
          source_table?: string
          target_schema?: string
          target_table?: string
        }
        Relationships: []
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
      beach_coordinate_corrections: {
        Row: {
          beach_id: string
          corrected_at: string
          id: string
          new_lat: number
          new_lon: number
          old_lat: number
          old_lon: number
          reason: string
          slug: string
        }
        Insert: {
          beach_id: string
          corrected_at?: string
          id?: string
          new_lat: number
          new_lon: number
          old_lat: number
          old_lon: number
          reason: string
          slug: string
        }
        Update: {
          beach_id?: string
          corrected_at?: string
          id?: string
          new_lat?: number
          new_lon?: number
          old_lat?: number
          old_lon?: number
          reason?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "beach_coordinate_corrections_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_coordinate_corrections_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_coordinate_corrections_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_coordinate_corrections_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_coordinate_corrections_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_coordinate_corrections_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_coordinate_corrections_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
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
      beach_feedback_calibration_candidates: {
        Row: {
          activated_at: string | null
          beach_id: string
          created_at: string
          decision_reason: string
          evidence_summary: Json
          evidence_window_end: string | null
          evidence_window_start: string | null
          expires_at: string | null
          id: string
          mae_after_ft: number
          mae_before_ft: number
          offset_ft: number
          rejected_at: string | null
          residual_direction: string
          sample_count: number
          shadow_started_at: string | null
          status: string
          unique_user_count: number
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          beach_id: string
          created_at?: string
          decision_reason: string
          evidence_summary?: Json
          evidence_window_end?: string | null
          evidence_window_start?: string | null
          expires_at?: string | null
          id?: string
          mae_after_ft: number
          mae_before_ft: number
          offset_ft: number
          rejected_at?: string | null
          residual_direction: string
          sample_count: number
          shadow_started_at?: string | null
          status?: string
          unique_user_count: number
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          beach_id?: string
          created_at?: string
          decision_reason?: string
          evidence_summary?: Json
          evidence_window_end?: string | null
          evidence_window_start?: string | null
          expires_at?: string | null
          id?: string
          mae_after_ft?: number
          mae_before_ft?: number
          offset_ft?: number
          rejected_at?: string | null
          residual_direction?: string
          sample_count?: number
          shadow_started_at?: string | null
          status?: string
          unique_user_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "beach_feedback_calibration_candidates_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_feedback_calibration_candidates_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_feedback_calibration_candidates_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_feedback_calibration_candidates_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_feedback_calibration_candidates_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_feedback_calibration_candidates_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_feedback_calibration_candidates_beach_id_fkey"
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
      beach_height_offsets: {
        Row: {
          beach_id: string
          computed_at: string
          mae_after_m: number | null
          mae_before_m: number | null
          offset_m: number
          sample_count: number
          source: string
          window_days: number
        }
        Insert: {
          beach_id: string
          computed_at?: string
          mae_after_m?: number | null
          mae_before_m?: number | null
          offset_m: number
          sample_count: number
          source?: string
          window_days?: number
        }
        Update: {
          beach_id?: string
          computed_at?: string
          mae_after_m?: number | null
          mae_before_m?: number | null
          offset_m?: number
          sample_count?: number
          source?: string
          window_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "beach_height_offsets_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_height_offsets_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_height_offsets_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_height_offsets_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_height_offsets_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_height_offsets_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_height_offsets_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
        ]
      }
      beach_photo_submission_votes: {
        Row: {
          created_at: string
          id: string
          submission_id: string
          vote: string
          voter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          submission_id: string
          vote: string
          voter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          submission_id?: string
          vote?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beach_photo_submission_votes_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "beach_photo_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_photo_submission_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "beach_photo_submission_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_photo_submission_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_photo_submission_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
          },
        ]
      }
      beach_photo_submissions: {
        Row: {
          beach_id: string
          caption: string | null
          created_at: string
          deleted_at: string | null
          id: string
          image_url: string
          license_code: string
          reviewed_at: string | null
          reviewed_by: string | null
          stale_count: number
          status: string
          storage_path: string
          submitted_by: string
          thumb_url: string | null
          useful_count: number
        }
        Insert: {
          beach_id: string
          caption?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          image_url: string
          license_code?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          stale_count?: number
          status?: string
          storage_path: string
          submitted_by: string
          thumb_url?: string | null
          useful_count?: number
        }
        Update: {
          beach_id?: string
          caption?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          image_url?: string
          license_code?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          stale_count?: number
          status?: string
          storage_path?: string
          submitted_by?: string
          thumb_url?: string | null
          useful_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "beach_photo_submissions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_photo_submissions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_photo_submissions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_photo_submissions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_photo_submissions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_photo_submissions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_photo_submissions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_photo_submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "beach_photo_submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_photo_submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_photo_submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "beach_photo_submissions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "beach_photo_submissions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_photo_submissions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_photo_submissions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
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
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
          },
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
          {
            foreignKeyName: "beach_photos_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
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
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
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
          {
            foreignKeyName: "beach_review_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
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
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
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
          {
            foreignKeyName: "beach_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
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
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
          },
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
          {
            foreignKeyName: "beach_reviews_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
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
      beach_traffic_weights: {
        Row: {
          allocation_tier: string
          beach_id: string
          computed_at: string
          market_key: string
          views_30d: number
          weight: number
        }
        Insert: {
          allocation_tier: string
          beach_id: string
          computed_at?: string
          market_key: string
          views_30d?: number
          weight?: number
        }
        Update: {
          allocation_tier?: string
          beach_id?: string
          computed_at?: string
          market_key?: string
          views_30d?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "beach_traffic_weights_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_traffic_weights_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_traffic_weights_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beach_traffic_weights_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_traffic_weights_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_traffic_weights_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "beach_traffic_weights_beach_id_fkey"
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
          deepwater_decay_factor: number | null
          deleted_at: string | null
          description: string | null
          editorial_reviewed_at: string | null
          editorial_sources: Json
          features: string[] | null
          geog: unknown
          hazards: string[] | null
          height_offset_enabled: boolean
          height_offset_max_age_days: number
          height_offset_min_sample_count: number
          id: string
          is_private: boolean
          lat: number
          local_etiquette: string | null
          lon: number
          max_wind_any_mph: number | null
          max_wind_onshore_mph: number | null
          name: string
          nws_forecast_zone: string | null
          nws_office: string | null
          owner_id: string | null
          parking_tips: string | null
          persona: Database["public"]["Enums"]["beach_persona"] | null
          preference_model: Json | null
          preferred_tide_direction: string | null
          preferred_tide_ft_max: number | null
          preferred_tide_ft_min: number | null
          real_takeaways: string[] | null
          region: string | null
          region_id: string | null
          review_count: number | null
          seo_indexable: boolean
          shoaling_factors: Json | null
          skill_level: string | null
          slug: string | null
          state: string | null
          swell_access_factors: number[] | null
          swell_analyzed_at: string | null
          swell_window_center_deg: number | null
          swell_window_center_deg_v2: number | null
          swell_window_halfwidth_deg: number | null
          swell_window_halfwidth_deg_v2: number | null
          swell_window_max_deg: number | null
          swell_window_max_deg_v2: number | null
          swell_window_min_deg: number | null
          swell_window_min_deg_v2: number | null
          swell_window_v2_analyzed_at: string | null
          swell_window_v2_method: string | null
          terrain_analysis_debug: Json | null
          terrain_analyzed_at: string | null
          terrain_enabled: boolean
          terrain_method: string | null
          terrain_params: Json | null
          terrain_params_hash: string | null
          terrain_status: string | null
          tide_direction_sensitivity: string | null
          timezone: string
          warnings: string[] | null
          wave_punchiness_ai: number | null
          wave_punchiness_ai_confidence: number | null
          wave_punchiness_ai_meta: Json | null
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
          deepwater_decay_factor?: number | null
          deleted_at?: string | null
          description?: string | null
          editorial_reviewed_at?: string | null
          editorial_sources?: Json
          features?: string[] | null
          geog?: unknown
          hazards?: string[] | null
          height_offset_enabled?: boolean
          height_offset_max_age_days?: number
          height_offset_min_sample_count?: number
          id?: string
          is_private?: boolean
          lat: number
          local_etiquette?: string | null
          lon: number
          max_wind_any_mph?: number | null
          max_wind_onshore_mph?: number | null
          name: string
          nws_forecast_zone?: string | null
          nws_office?: string | null
          owner_id?: string | null
          parking_tips?: string | null
          persona?: Database["public"]["Enums"]["beach_persona"] | null
          preference_model?: Json | null
          preferred_tide_direction?: string | null
          preferred_tide_ft_max?: number | null
          preferred_tide_ft_min?: number | null
          real_takeaways?: string[] | null
          region?: string | null
          region_id?: string | null
          review_count?: number | null
          seo_indexable?: boolean
          shoaling_factors?: Json | null
          skill_level?: string | null
          slug?: string | null
          state?: string | null
          swell_access_factors?: number[] | null
          swell_analyzed_at?: string | null
          swell_window_center_deg?: number | null
          swell_window_center_deg_v2?: number | null
          swell_window_halfwidth_deg?: number | null
          swell_window_halfwidth_deg_v2?: number | null
          swell_window_max_deg?: number | null
          swell_window_max_deg_v2?: number | null
          swell_window_min_deg?: number | null
          swell_window_min_deg_v2?: number | null
          swell_window_v2_analyzed_at?: string | null
          swell_window_v2_method?: string | null
          terrain_analysis_debug?: Json | null
          terrain_analyzed_at?: string | null
          terrain_enabled?: boolean
          terrain_method?: string | null
          terrain_params?: Json | null
          terrain_params_hash?: string | null
          terrain_status?: string | null
          tide_direction_sensitivity?: string | null
          timezone: string
          warnings?: string[] | null
          wave_punchiness_ai?: number | null
          wave_punchiness_ai_confidence?: number | null
          wave_punchiness_ai_meta?: Json | null
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
          deepwater_decay_factor?: number | null
          deleted_at?: string | null
          description?: string | null
          editorial_reviewed_at?: string | null
          editorial_sources?: Json
          features?: string[] | null
          geog?: unknown
          hazards?: string[] | null
          height_offset_enabled?: boolean
          height_offset_max_age_days?: number
          height_offset_min_sample_count?: number
          id?: string
          is_private?: boolean
          lat?: number
          local_etiquette?: string | null
          lon?: number
          max_wind_any_mph?: number | null
          max_wind_onshore_mph?: number | null
          name?: string
          nws_forecast_zone?: string | null
          nws_office?: string | null
          owner_id?: string | null
          parking_tips?: string | null
          persona?: Database["public"]["Enums"]["beach_persona"] | null
          preference_model?: Json | null
          preferred_tide_direction?: string | null
          preferred_tide_ft_max?: number | null
          preferred_tide_ft_min?: number | null
          real_takeaways?: string[] | null
          region?: string | null
          region_id?: string | null
          review_count?: number | null
          seo_indexable?: boolean
          shoaling_factors?: Json | null
          skill_level?: string | null
          slug?: string | null
          state?: string | null
          swell_access_factors?: number[] | null
          swell_analyzed_at?: string | null
          swell_window_center_deg?: number | null
          swell_window_center_deg_v2?: number | null
          swell_window_halfwidth_deg?: number | null
          swell_window_halfwidth_deg_v2?: number | null
          swell_window_max_deg?: number | null
          swell_window_max_deg_v2?: number | null
          swell_window_min_deg?: number | null
          swell_window_min_deg_v2?: number | null
          swell_window_v2_analyzed_at?: string | null
          swell_window_v2_method?: string | null
          terrain_analysis_debug?: Json | null
          terrain_analyzed_at?: string | null
          terrain_enabled?: boolean
          terrain_method?: string | null
          terrain_params?: Json | null
          terrain_params_hash?: string | null
          terrain_status?: string | null
          tide_direction_sensitivity?: string | null
          timezone?: string
          warnings?: string[] | null
          wave_punchiness_ai?: number | null
          wave_punchiness_ai_confidence?: number | null
          wave_punchiness_ai_meta?: Json | null
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
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
          },
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
          {
            foreignKeyName: "beaches_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
          },
        ]
      }
      boards: {
        Row: {
          board_type: string
          color: string | null
          created_at: string | null
          description: string | null
          dimensions: string
          fin_setup: string | null
          id: string
          image_url: string | null
          model: string | null
          name: string
          session_count: number | null
          shaper: string | null
          size: string | null
          thickness: string | null
          updated_at: string | null
          user_id: string
          volume: number | null
          width: string | null
        }
        Insert: {
          board_type: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          dimensions: string
          fin_setup?: string | null
          id?: string
          image_url?: string | null
          model?: string | null
          name: string
          session_count?: number | null
          shaper?: string | null
          size?: string | null
          thickness?: string | null
          updated_at?: string | null
          user_id: string
          volume?: number | null
          width?: string | null
        }
        Update: {
          board_type?: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          dimensions?: string
          fin_setup?: string | null
          id?: string
          image_url?: string | null
          model?: string | null
          name?: string
          session_count?: number | null
          shaper?: string | null
          size?: string | null
          thickness?: string | null
          updated_at?: string | null
          user_id?: string
          volume?: number | null
          width?: string | null
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
          editorial_reviewed_at: string | null
          editorial_sources: Json
          featured_intents: string[]
          id: string
          intent: string | null
          planning_checklist: string[]
          quick_links: Json
          region_label: string
          seo_indexable: boolean
          seo_intro: string | null
          seo_local_guidance: string | null
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
          editorial_reviewed_at?: string | null
          editorial_sources?: Json
          featured_intents?: string[]
          id?: string
          intent?: string | null
          planning_checklist?: string[]
          quick_links?: Json
          region_label: string
          seo_indexable?: boolean
          seo_intro?: string | null
          seo_local_guidance?: string | null
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
          editorial_reviewed_at?: string | null
          editorial_sources?: Json
          featured_intents?: string[]
          id?: string
          intent?: string | null
          planning_checklist?: string[]
          quick_links?: Json
          region_label?: string
          seo_indexable?: boolean
          seo_intro?: string | null
          seo_local_guidance?: string | null
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
            referencedRelation: "public_session_feed_eligibility"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "comments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "recommendation_feedback_summary"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "comments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["first_session_id"]
          },
          {
            foreignKeyName: "comments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["second_session_within_14d_id"]
          },
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
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
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
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
          },
        ]
      }
      community_photo_action_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          idempotency_key: string
          outcome: string
          photo_id: string | null
          reason_code: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          outcome: string
          photo_id?: string | null
          reason_code: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          outcome?: string
          photo_id?: string | null
          reason_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_photo_action_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      community_photo_consents: {
        Row: {
          confirmed_at: string
          contributor_id: string | null
          photo_id: string
          rights_confirmed: boolean
          terms_version: string
        }
        Insert: {
          confirmed_at?: string
          contributor_id?: string | null
          photo_id: string
          rights_confirmed: boolean
          terms_version: string
        }
        Update: {
          confirmed_at?: string
          contributor_id?: string | null
          photo_id?: string
          rights_confirmed?: boolean
          terms_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_photo_consents_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "community_photo_consents_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: true
            referencedRelation: "community_spot_photos"
            referencedColumns: ["id"]
          },
        ]
      }
      community_photo_contributor_restrictions: {
        Row: {
          applied_at: string
          applied_by: string | null
          contributor_id: string
          lifted_at: string | null
          lifted_by: string | null
          reason_code: string
          restricted_until: string | null
        }
        Insert: {
          applied_at?: string
          applied_by?: string | null
          contributor_id: string
          lifted_at?: string | null
          lifted_by?: string | null
          reason_code: string
          restricted_until?: string | null
        }
        Update: {
          applied_at?: string
          applied_by?: string | null
          contributor_id?: string
          lifted_at?: string | null
          lifted_by?: string | null
          reason_code?: string
          restricted_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_photo_contributor_restrictions_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "community_photo_contributor_restrictions_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: true
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "community_photo_contributor_restrictions_lifted_by_fkey"
            columns: ["lifted_by"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      community_photo_feature_config: {
        Row: {
          read_enabled: boolean
          singleton: boolean
          terms_version: string
          updated_at: string
          writes_enabled: boolean
        }
        Insert: {
          read_enabled?: boolean
          singleton?: boolean
          terms_version?: string
          updated_at?: string
          writes_enabled?: boolean
        }
        Update: {
          read_enabled?: boolean
          singleton?: boolean
          terms_version?: string
          updated_at?: string
          writes_enabled?: boolean
        }
        Relationships: []
      }
      community_photo_feature_pins: {
        Row: {
          beach_id: string | null
          custom_spot_id: string | null
          id: string
          photo_id: string
          pinned_at: string
          pinned_by: string | null
          revoked_at: string | null
          revoked_by: string | null
          target_type: string
        }
        Insert: {
          beach_id?: string | null
          custom_spot_id?: string | null
          id?: string
          photo_id: string
          pinned_at?: string
          pinned_by?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          target_type: string
        }
        Update: {
          beach_id?: string | null
          custom_spot_id?: string | null
          id?: string
          photo_id?: string
          pinned_at?: string
          pinned_by?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_photo_feature_pins_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_photo_feature_pins_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "community_photo_feature_pins_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_photo_feature_pins_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "community_photo_feature_pins_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "community_photo_feature_pins_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "community_photo_feature_pins_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "community_photo_feature_pins_custom_spot_id_fkey"
            columns: ["custom_spot_id"]
            isOneToOne: false
            referencedRelation: "custom_spots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_photo_feature_pins_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "community_spot_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_photo_feature_pins_pinned_by_fkey"
            columns: ["pinned_by"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "community_photo_feature_pins_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      community_photo_investigation_holds: {
        Row: {
          id: string
          photo_id: string
          placed_at: string
          placed_by: string | null
          reason: string
          released_at: string | null
          released_by: string | null
        }
        Insert: {
          id?: string
          photo_id: string
          placed_at?: string
          placed_by?: string | null
          reason: string
          released_at?: string | null
          released_by?: string | null
        }
        Update: {
          id?: string
          photo_id?: string
          placed_at?: string
          placed_by?: string | null
          reason?: string
          released_at?: string | null
          released_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_photo_investigation_holds_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "community_spot_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_photo_investigation_holds_placed_by_fkey"
            columns: ["placed_by"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "community_photo_investigation_holds_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      community_photo_moderation_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          idempotency_key: string
          photo_id: string | null
          reason: string
          subject_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          photo_id?: string | null
          reason: string
          subject_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          photo_id?: string | null
          reason?: string
          subject_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_photo_moderation_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "community_photo_moderation_events_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "community_spot_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_photo_moderation_events_subject_user_id_fkey"
            columns: ["subject_user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      community_photo_reports: {
        Row: {
          created_at: string
          photo_id: string
          reason: string
          reporter_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          photo_id: string
          reason: string
          reporter_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          photo_id?: string
          reason?: string
          reporter_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_photo_reports_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "community_spot_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_photo_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      community_photo_votes: {
        Row: {
          created_at: string
          photo_id: string
          updated_at: string
          vote: string
          voter_id: string
        }
        Insert: {
          created_at?: string
          photo_id: string
          updated_at?: string
          vote: string
          voter_id: string
        }
        Update: {
          created_at?: string
          photo_id?: string
          updated_at?: string
          vote?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_photo_votes_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "community_spot_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_photo_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      community_spot_photos: {
        Row: {
          beach_id: string | null
          content_type: string
          created_at: string
          custom_spot_id: string | null
          height: number | null
          hidden_reason: string | null
          id: string
          idempotency_key: string
          lifecycle_status: string
          moderation_status: string
          processing_status: string
          recoverable_until: string | null
          removed_at: string | null
          storage_path: string
          target_type: string
          updated_at: string
          uploader_id: string | null
          visibility: string
          width: number | null
        }
        Insert: {
          beach_id?: string | null
          content_type?: string
          created_at?: string
          custom_spot_id?: string | null
          height?: number | null
          hidden_reason?: string | null
          id?: string
          idempotency_key: string
          lifecycle_status?: string
          moderation_status?: string
          processing_status?: string
          recoverable_until?: string | null
          removed_at?: string | null
          storage_path: string
          target_type: string
          updated_at?: string
          uploader_id?: string | null
          visibility: string
          width?: number | null
        }
        Update: {
          beach_id?: string | null
          content_type?: string
          created_at?: string
          custom_spot_id?: string | null
          height?: number | null
          hidden_reason?: string | null
          id?: string
          idempotency_key?: string
          lifecycle_status?: string
          moderation_status?: string
          processing_status?: string
          recoverable_until?: string | null
          removed_at?: string | null
          storage_path?: string
          target_type?: string
          updated_at?: string
          uploader_id?: string | null
          visibility?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "community_spot_photos_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_spot_photos_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "community_spot_photos_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_spot_photos_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "community_spot_photos_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "community_spot_photos_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "community_spot_photos_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "community_spot_photos_custom_spot_id_fkey"
            columns: ["custom_spot_id"]
            isOneToOne: false
            referencedRelation: "custom_spots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_spot_photos_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      content_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          moderator_id: string | null
          moderator_notes: string | null
          reason: Database["public"]["Enums"]["content_report_reason"]
          reporter_id: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["content_report_status"]
          target_id: string
          target_owner_id: string | null
          target_type: Database["public"]["Enums"]["content_report_target"]
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          moderator_id?: string | null
          moderator_notes?: string | null
          reason: Database["public"]["Enums"]["content_report_reason"]
          reporter_id?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["content_report_status"]
          target_id: string
          target_owner_id?: string | null
          target_type: Database["public"]["Enums"]["content_report_target"]
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          moderator_id?: string | null
          moderator_notes?: string | null
          reason?: Database["public"]["Enums"]["content_report_reason"]
          reporter_id?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["content_report_status"]
          target_id?: string
          target_owner_id?: string | null
          target_type?: Database["public"]["Enums"]["content_report_target"]
        }
        Relationships: [
          {
            foreignKeyName: "content_reports_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "content_reports_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_reports_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_reports_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "content_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "content_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "content_reports_target_owner_id_fkey"
            columns: ["target_owner_id"]
            isOneToOne: false
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "content_reports_target_owner_id_fkey"
            columns: ["target_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_reports_target_owner_id_fkey"
            columns: ["target_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_reports_target_owner_id_fkey"
            columns: ["target_owner_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
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
          primary_source: string
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
          primary_source?: string
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
          primary_source?: string
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
      county_beach_advisories: {
        Row: {
          advisory_type: string
          beach_id: string | null
          county_latitude: number
          county_longitude: number
          created_at: string
          fetched_at: string
          id: string
          match_distance_meters: number | null
          raw_payload: Json
          raw_payload_hash: string
          run_id: string
          source_identifier: string
          source_name: string
          source_site_identifier: string
          source_url: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          advisory_type: string
          beach_id?: string | null
          county_latitude: number
          county_longitude: number
          created_at?: string
          fetched_at: string
          id?: string
          match_distance_meters?: number | null
          raw_payload: Json
          raw_payload_hash: string
          run_id: string
          source_identifier: string
          source_name: string
          source_site_identifier: string
          source_url: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          advisory_type?: string
          beach_id?: string | null
          county_latitude?: number
          county_longitude?: number
          created_at?: string
          fetched_at?: string
          id?: string
          match_distance_meters?: number | null
          raw_payload?: Json
          raw_payload_hash?: string
          run_id?: string
          source_identifier?: string
          source_name?: string
          source_site_identifier?: string
          source_url?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "county_beach_advisories_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "county_beach_advisories_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "county_beach_advisories_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "county_beach_advisories_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "county_beach_advisories_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "county_beach_advisories_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "county_beach_advisories_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "county_beach_advisories_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "county_beach_advisory_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      county_beach_advisory_ingest_state: {
        Row: {
          accepted_version_sequence: number | null
          accepted_version_token: string | null
          circuit_open: boolean
          consecutive_failures: number
          created_at: string
          last_error: string | null
          last_failure_at: string | null
          last_request_at: string | null
          last_success_at: string | null
          next_attempt_at: string | null
          observed_version_sequence: number | null
          observed_version_token: string | null
          source_identifier: string
          updated_at: string
        }
        Insert: {
          accepted_version_sequence?: number | null
          accepted_version_token?: string | null
          circuit_open?: boolean
          consecutive_failures?: number
          created_at?: string
          last_error?: string | null
          last_failure_at?: string | null
          last_request_at?: string | null
          last_success_at?: string | null
          next_attempt_at?: string | null
          observed_version_sequence?: number | null
          observed_version_token?: string | null
          source_identifier: string
          updated_at?: string
        }
        Update: {
          accepted_version_sequence?: number | null
          accepted_version_token?: string | null
          circuit_open?: boolean
          consecutive_failures?: number
          created_at?: string
          last_error?: string | null
          last_failure_at?: string | null
          last_request_at?: string | null
          last_success_at?: string | null
          next_attempt_at?: string | null
          observed_version_sequence?: number | null
          observed_version_token?: string | null
          source_identifier?: string
          updated_at?: string
        }
        Relationships: []
      }
      county_beach_advisory_runs: {
        Row: {
          advisory_count: number
          closure_count: number
          completed_at: string | null
          created_at: string
          error_kind: string | null
          error_message: string | null
          fetched_at: string
          id: string
          match_rate: number | null
          source_identifier: string
          status: string
          unmatched_site_count: number
          version_sequence: number
          version_token: string
          warning_count: number
        }
        Insert: {
          advisory_count?: number
          closure_count?: number
          completed_at?: string | null
          created_at?: string
          error_kind?: string | null
          error_message?: string | null
          fetched_at: string
          id?: string
          match_rate?: number | null
          source_identifier: string
          status: string
          unmatched_site_count?: number
          version_sequence: number
          version_token: string
          warning_count?: number
        }
        Update: {
          advisory_count?: number
          closure_count?: number
          completed_at?: string | null
          created_at?: string
          error_kind?: string | null
          error_message?: string | null
          fetched_at?: string
          id?: string
          match_rate?: number | null
          source_identifier?: string
          status?: string
          unmatched_site_count?: number
          version_sequence?: number
          version_token?: string
          warning_count?: number
        }
        Relationships: []
      }
      cron_runs: {
        Row: {
          duration_ms: number | null
          error_message: string | null
          expected_max: number | null
          expected_min: number | null
          finished_at: string | null
          id: string
          job: string
          legitimately_zero_reason: string | null
          produced: number | null
          ran_at: string
          route: string
          started_at: string
          status: string
          summary: Json | null
          unit: string | null
        }
        Insert: {
          duration_ms?: number | null
          error_message?: string | null
          expected_max?: number | null
          expected_min?: number | null
          finished_at?: string | null
          id?: string
          job: string
          legitimately_zero_reason?: string | null
          produced?: number | null
          ran_at?: string
          route: string
          started_at?: string
          status: string
          summary?: Json | null
          unit?: string | null
        }
        Update: {
          duration_ms?: number | null
          error_message?: string | null
          expected_max?: number | null
          expected_min?: number | null
          finished_at?: string | null
          id?: string
          job?: string
          legitimately_zero_reason?: string | null
          produced?: number | null
          ran_at?: string
          route?: string
          started_at?: string
          status?: string
          summary?: Json | null
          unit?: string | null
        }
        Relationships: []
      }
      custom_spots: {
        Row: {
          break_type: string | null
          created_at: string
          deleted_at: string | null
          exposure_level: string | null
          facing_direction_deg: number | null
          fingerprint_confidence: string | null
          fingerprint_updated_at: string | null
          id: string
          lat: number
          lon: number
          name: string
          nearest_beach_distance_mi: number | null
          nearest_beach_id: string | null
          offshore_direction_deg: number | null
          swell_window_max_deg: number | null
          swell_window_min_deg: number | null
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          break_type?: string | null
          created_at?: string
          deleted_at?: string | null
          exposure_level?: string | null
          facing_direction_deg?: number | null
          fingerprint_confidence?: string | null
          fingerprint_updated_at?: string | null
          id?: string
          lat: number
          lon: number
          name: string
          nearest_beach_distance_mi?: number | null
          nearest_beach_id?: string | null
          offshore_direction_deg?: number | null
          swell_window_max_deg?: number | null
          swell_window_min_deg?: number | null
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          break_type?: string | null
          created_at?: string
          deleted_at?: string | null
          exposure_level?: string | null
          facing_direction_deg?: number | null
          fingerprint_confidence?: string | null
          fingerprint_updated_at?: string | null
          id?: string
          lat?: number
          lon?: number
          name?: string
          nearest_beach_distance_mi?: number | null
          nearest_beach_id?: string | null
          offshore_direction_deg?: number | null
          swell_window_max_deg?: number | null
          swell_window_min_deg?: number | null
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_spots_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_spots_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "custom_spots_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_spots_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "custom_spots_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "custom_spots_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "custom_spots_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "custom_spots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      daily_calls: {
        Row: {
          beach_id: string | null
          call_date: string
          created_at: string
          id: string
          prediction: string
          user_id: string
        }
        Insert: {
          beach_id?: string | null
          call_date: string
          created_at?: string
          id?: string
          prediction: string
          user_id: string
        }
        Update: {
          beach_id?: string | null
          call_date?: string
          created_at?: string
          id?: string
          prediction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_calls_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_calls_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "daily_calls_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_calls_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "daily_calls_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "daily_calls_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "daily_calls_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "daily_calls_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
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
      dev_session_mutation_audit: {
        Row: {
          application_name: string | null
          at: string
          client_addr: unknown
          current_query: string | null
          current_user_role: unknown
          id: number
          new_row: Json | null
          old_row: Json | null
          op: string
          session_id: string | null
          session_user_role: unknown
          txid: number
          user_id: string | null
        }
        Insert: {
          application_name?: string | null
          at?: string
          client_addr?: unknown
          current_query?: string | null
          current_user_role?: unknown
          id?: number
          new_row?: Json | null
          old_row?: Json | null
          op: string
          session_id?: string | null
          session_user_role?: unknown
          txid?: number
          user_id?: string | null
        }
        Update: {
          application_name?: string | null
          at?: string
          client_addr?: unknown
          current_query?: string | null
          current_user_role?: unknown
          id?: number
          new_row?: Json | null
          old_row?: Json | null
          op?: string
          session_id?: string | null
          session_user_role?: unknown
          txid?: number
          user_id?: string | null
        }
        Relationships: []
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
      earned_pro_grants: {
        Row: {
          created_at: string
          entitlement_id: string
          expires_at: string
          granted_at: string
          id: string
          reason: string
          revoked_at: string | null
          streak_snapshot: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entitlement_id: string
          expires_at: string
          granted_at?: string
          id?: string
          reason: string
          revoked_at?: string | null
          streak_snapshot?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entitlement_id?: string
          expires_at?: string
          granted_at?: string
          id?: string
          reason?: string
          revoked_at?: string | null
          streak_snapshot?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "earned_pro_grants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      email_click_events: {
        Row: {
          clicked_at: string
          created_at: string
          email_send_log_id: number | null
          id: number
          link: string
          resend_message_id: string
          user_agent: string | null
          webhook_message_id: string | null
        }
        Insert: {
          clicked_at: string
          created_at?: string
          email_send_log_id?: number | null
          id?: number
          link: string
          resend_message_id: string
          user_agent?: string | null
          webhook_message_id?: string | null
        }
        Update: {
          clicked_at?: string
          created_at?: string
          email_send_log_id?: number | null
          id?: number
          link?: string
          resend_message_id?: string
          user_agent?: string | null
          webhook_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_click_events_email_send_log_id_fkey"
            columns: ["email_send_log_id"]
            isOneToOne: false
            referencedRelation: "email_send_log"
            referencedColumns: ["id"]
          },
        ]
      }
      email_delivery_events: {
        Row: {
          created_at: string
          email_send_log_id: number | null
          event_at: string
          event_type: string
          id: number
          resend_message_id: string
          webhook_message_id: string
        }
        Insert: {
          created_at?: string
          email_send_log_id?: number | null
          event_at: string
          event_type: string
          id?: number
          resend_message_id: string
          webhook_message_id: string
        }
        Update: {
          created_at?: string
          email_send_log_id?: number | null
          event_at?: string
          event_type?: string
          id?: number
          resend_message_id?: string
          webhook_message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_delivery_events_email_send_log_id_fkey"
            columns: ["email_send_log_id"]
            isOneToOne: false
            referencedRelation: "email_send_log"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "email_send_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
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
          om_fetched_at: string | null
          raw_forecast: Json | null
          swell_1_direction: string | null
          swell_1_height: string | null
          swell_1_period: string | null
          swell_2_direction: string | null
          swell_2_height: string | null
          swell_2_period: string | null
          swell_direction_om: number | null
          swell_height_om: number | null
          swell_period_om: number | null
          tide_height: string | null
          tide_status: string | null
          updated_at: string
          water_temp: string | null
          wave_direction: string | null
          wave_direction_om: number | null
          wave_height: string | null
          wave_height_om: number | null
          wave_period: string | null
          wave_period_om: number | null
          weather_condition: string | null
          wind_direction: string | null
          wind_direction_deg: number | null
          wind_source: string | null
          wind_speed: string | null
          wind_wave_direction: string | null
          wind_wave_height: string | null
          wind_wave_height_om: number | null
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
          om_fetched_at?: string | null
          raw_forecast?: Json | null
          swell_1_direction?: string | null
          swell_1_height?: string | null
          swell_1_period?: string | null
          swell_2_direction?: string | null
          swell_2_height?: string | null
          swell_2_period?: string | null
          swell_direction_om?: number | null
          swell_height_om?: number | null
          swell_period_om?: number | null
          tide_height?: string | null
          tide_status?: string | null
          updated_at?: string
          water_temp?: string | null
          wave_direction?: string | null
          wave_direction_om?: number | null
          wave_height?: string | null
          wave_height_om?: number | null
          wave_period?: string | null
          wave_period_om?: number | null
          weather_condition?: string | null
          wind_direction?: string | null
          wind_direction_deg?: number | null
          wind_source?: string | null
          wind_speed?: string | null
          wind_wave_direction?: string | null
          wind_wave_height?: string | null
          wind_wave_height_om?: number | null
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
          om_fetched_at?: string | null
          raw_forecast?: Json | null
          swell_1_direction?: string | null
          swell_1_height?: string | null
          swell_1_period?: string | null
          swell_2_direction?: string | null
          swell_2_height?: string | null
          swell_2_period?: string | null
          swell_direction_om?: number | null
          swell_height_om?: number | null
          swell_period_om?: number | null
          tide_height?: string | null
          tide_status?: string | null
          updated_at?: string
          water_temp?: string | null
          wave_direction?: string | null
          wave_direction_om?: number | null
          wave_height?: string | null
          wave_height_om?: number | null
          wave_period?: string | null
          wave_period_om?: number | null
          weather_condition?: string | null
          wind_direction?: string | null
          wind_direction_deg?: number | null
          wind_source?: string | null
          wind_speed?: string | null
          wind_wave_direction?: string | null
          wind_wave_height?: string | null
          wind_wave_height_om?: number | null
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
      experiment_assignments: {
        Row: {
          arm: number
          assignment_version: string
          build: string | null
          created_at: string
          experiment_key: string
          index_at: string
          linked_at: string | null
          source: string | null
          user_id: string
        }
        Insert: {
          arm: number
          assignment_version?: string
          build?: string | null
          created_at?: string
          experiment_key: string
          index_at?: string
          linked_at?: string | null
          source?: string | null
          user_id: string
        }
        Update: {
          arm?: number
          assignment_version?: string
          build?: string | null
          created_at?: string
          experiment_key?: string
          index_at?: string
          linked_at?: string | null
          source?: string | null
          user_id?: string
        }
        Relationships: []
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
          beach_id: string | null
          created_at: string | null
          custom_spot_id: string | null
          id: string
          rank: number | null
          user_id: string
        }
        Insert: {
          alerts_enabled?: boolean
          beach_id?: string | null
          created_at?: string | null
          custom_spot_id?: string | null
          id?: string
          rank?: number | null
          user_id: string
        }
        Update: {
          alerts_enabled?: boolean
          beach_id?: string | null
          created_at?: string | null
          custom_spot_id?: string | null
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
            foreignKeyName: "favorite_beaches_custom_spot_id_fkey"
            columns: ["custom_spot_id"]
            isOneToOne: false
            referencedRelation: "custom_spots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_beaches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
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
          {
            foreignKeyName: "favorite_beaches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
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
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
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
          {
            foreignKeyName: "forecast_accuracy_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
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
          {
            foreignKeyName: "forecast_alert_deliveries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      forecast_feedback_contexts: {
        Row: {
          anonymous_client_id: string | null
          audit_metadata: Json
          beach_id: string
          calibration_context: Json
          client_source: string
          client_version: string | null
          contract_version: string
          correlation_id: string | null
          created_at: string
          displayed_context: Json
          feedback_kind: string
          feedback_note: string | null
          feedback_value: string
          forecast_at: string
          forecast_horizon_hours: number | null
          id: string
          ingest_path: string
          issued_at: string | null
          missing_flags: Json
          predicted_at: string | null
          request_id: string | null
          schema_version: number
          session_id: string | null
          source_model_context: Json
          surf_call_context: Json
          updated_at: string
          user_id: string | null
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          anonymous_client_id?: string | null
          audit_metadata?: Json
          beach_id: string
          calibration_context?: Json
          client_source: string
          client_version?: string | null
          contract_version?: string
          correlation_id?: string | null
          created_at?: string
          displayed_context?: Json
          feedback_kind: string
          feedback_note?: string | null
          feedback_value: string
          forecast_at: string
          forecast_horizon_hours?: number | null
          id?: string
          ingest_path: string
          issued_at?: string | null
          missing_flags?: Json
          predicted_at?: string | null
          request_id?: string | null
          schema_version?: number
          session_id?: string | null
          source_model_context?: Json
          surf_call_context?: Json
          updated_at?: string
          user_id?: string | null
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          anonymous_client_id?: string | null
          audit_metadata?: Json
          beach_id?: string
          calibration_context?: Json
          client_source?: string
          client_version?: string | null
          contract_version?: string
          correlation_id?: string | null
          created_at?: string
          displayed_context?: Json
          feedback_kind?: string
          feedback_note?: string | null
          feedback_value?: string
          forecast_at?: string
          forecast_horizon_hours?: number | null
          id?: string
          ingest_path?: string
          issued_at?: string | null
          missing_flags?: Json
          predicted_at?: string | null
          request_id?: string | null
          schema_version?: number
          session_id?: string | null
          source_model_context?: Json
          surf_call_context?: Json
          updated_at?: string
          user_id?: string | null
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: []
      }
      garmin_accounts: {
        Row: {
          connected_at: string | null
          designated_activity_types: Json
          garmin_user_id: string | null
          oauth_token: string | null
          oauth_token_secret: string | null
          revoked_at: string | null
          scopes: string[] | null
          user_id: string
        }
        Insert: {
          connected_at?: string | null
          designated_activity_types?: Json
          garmin_user_id?: string | null
          oauth_token?: string | null
          oauth_token_secret?: string | null
          revoked_at?: string | null
          scopes?: string[] | null
          user_id: string
        }
        Update: {
          connected_at?: string | null
          designated_activity_types?: Json
          garmin_user_id?: string | null
          oauth_token?: string | null
          oauth_token_secret?: string | null
          revoked_at?: string | null
          scopes?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garmin_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      garmin_session_candidates: {
        Row: {
          beach_id: string | null
          created_at: string | null
          duration_seconds: number | null
          garmin_activity_id: string
          id: string
          started_at: string
          state: string
          user_id: string
        }
        Insert: {
          beach_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          garmin_activity_id: string
          id?: string
          started_at: string
          state?: string
          user_id: string
        }
        Update: {
          beach_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          garmin_activity_id?: string
          id?: string
          started_at?: string
          state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garmin_session_candidates_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garmin_session_candidates_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "garmin_session_candidates_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garmin_session_candidates_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "garmin_session_candidates_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "garmin_session_candidates_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "garmin_session_candidates_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "garmin_session_candidates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      gfs_wave_shadow_forecasts: {
        Row: {
          beach_id: string
          capture_status: string
          created_at: string
          fetched_at: string
          forecast_horizon_hours: number
          id: string
          predicted_at: string
          secondary_swell_direction_deg: number | null
          secondary_swell_height_m: number | null
          secondary_swell_period_s: number | null
          source: string
          source_model: string
          swell_direction_deg: number | null
          swell_height_m: number | null
          swell_period_s: number | null
          swell_wave_peak_period_s: number | null
          tertiary_swell_direction_deg: number | null
          tertiary_swell_height_m: number | null
          tertiary_swell_period_s: number | null
          wave_direction_deg: number | null
          wave_height_m: number | null
          wave_peak_period_s: number | null
          wave_period_s: number | null
          wind_wave_direction_deg: number | null
          wind_wave_height_m: number | null
          wind_wave_peak_period_s: number | null
          wind_wave_period_s: number | null
        }
        Insert: {
          beach_id: string
          capture_status?: string
          created_at?: string
          fetched_at: string
          forecast_horizon_hours: number
          id?: string
          predicted_at: string
          secondary_swell_direction_deg?: number | null
          secondary_swell_height_m?: number | null
          secondary_swell_period_s?: number | null
          source?: string
          source_model?: string
          swell_direction_deg?: number | null
          swell_height_m?: number | null
          swell_period_s?: number | null
          swell_wave_peak_period_s?: number | null
          tertiary_swell_direction_deg?: number | null
          tertiary_swell_height_m?: number | null
          tertiary_swell_period_s?: number | null
          wave_direction_deg?: number | null
          wave_height_m?: number | null
          wave_peak_period_s?: number | null
          wave_period_s?: number | null
          wind_wave_direction_deg?: number | null
          wind_wave_height_m?: number | null
          wind_wave_peak_period_s?: number | null
          wind_wave_period_s?: number | null
        }
        Update: {
          beach_id?: string
          capture_status?: string
          created_at?: string
          fetched_at?: string
          forecast_horizon_hours?: number
          id?: string
          predicted_at?: string
          secondary_swell_direction_deg?: number | null
          secondary_swell_height_m?: number | null
          secondary_swell_period_s?: number | null
          source?: string
          source_model?: string
          swell_direction_deg?: number | null
          swell_height_m?: number | null
          swell_period_s?: number | null
          swell_wave_peak_period_s?: number | null
          tertiary_swell_direction_deg?: number | null
          tertiary_swell_height_m?: number | null
          tertiary_swell_period_s?: number | null
          wave_direction_deg?: number | null
          wave_height_m?: number | null
          wave_peak_period_s?: number | null
          wave_period_s?: number | null
          wind_wave_direction_deg?: number | null
          wind_wave_height_m?: number | null
          wind_wave_peak_period_s?: number | null
          wind_wave_period_s?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gfs_wave_shadow_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gfs_wave_shadow_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "gfs_wave_shadow_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gfs_wave_shadow_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "gfs_wave_shadow_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "gfs_wave_shadow_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "gfs_wave_shadow_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
        ]
      }
      install_attribution_audit: {
        Row: {
          action: string
          created_at: string
          id: number
          outcome: string
          token_hash_prefix: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: never
          outcome: string
          token_hash_prefix: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: never
          outcome?: string
          token_hash_prefix?: string
        }
        Relationships: []
      }
      install_attribution_tokens: {
        Row: {
          campaign: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          placement: string
          redemption_key_hash: string | null
          source: string
          surface: string
          token_hash: string
        }
        Insert: {
          campaign: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          placement: string
          redemption_key_hash?: string | null
          source: string
          surface: string
          token_hash: string
        }
        Update: {
          campaign?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          placement?: string
          redemption_key_hash?: string | null
          source?: string
          surface?: string
          token_hash?: string
        }
        Relationships: []
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
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
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
          {
            foreignKeyName: "intel_post_confirmations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
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
          session_id: string | null
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
          session_id?: string | null
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
          session_id?: string | null
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
            foreignKeyName: "intel_posts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "public_session_feed_eligibility"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "intel_posts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "recommendation_feedback_summary"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "intel_posts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["first_session_id"]
          },
          {
            foreignKeyName: "intel_posts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["second_session_within_14d_id"]
          },
          {
            foreignKeyName: "intel_posts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
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
          {
            foreignKeyName: "intel_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
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
          {
            foreignKeyName: "intel_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
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
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
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
          {
            foreignKeyName: "intel_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
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
      ml_calibration_versions: {
        Row: {
          fitted_at: string
          g_dir: Json
          guardrails: Json | null
          is_active: boolean
          knots: Json
          notes: string | null
          train_n: number
          train_window_end: string
          train_window_start: string
          version: string
        }
        Insert: {
          fitted_at?: string
          g_dir: Json
          guardrails?: Json | null
          is_active?: boolean
          knots: Json
          notes?: string | null
          train_n: number
          train_window_end: string
          train_window_start: string
          version: string
        }
        Update: {
          fitted_at?: string
          g_dir?: Json
          guardrails?: Json | null
          is_active?: boolean
          knots?: Json
          notes?: string | null
          train_n?: number
          train_window_end?: string
          train_window_start?: string
          version?: string
        }
        Relationships: []
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
          direction_bucket: string | null
          display_raw_input_height_m: number | null
          display_source: string | null
          display_wave_source: string | null
          feedback_height_calibration_applied: boolean
          feedback_height_calibration_candidate_id: string | null
          feedback_height_offset_ft: number | null
          forecast_horizon_bucket: string | null
          forecast_horizon_hours: number | null
          height_offset_m: number | null
          height_offset_sample_count: number | null
          id: string
          ml_skipped: boolean
          model_version: string
          noaa_swell_1_direction_deg: number | null
          noaa_swell_1_height_m: number | null
          noaa_swell_1_period_s: number | null
          noaa_swell_2_direction_deg: number | null
          noaa_swell_2_height_m: number | null
          noaa_swell_2_period_s: number | null
          noaa_wind_wave_direction_deg: number | null
          noaa_wind_wave_height_m: number | null
          noaa_wind_wave_period_s: number | null
          observed_m: number | null
          offset_corrected_display_height_m: number | null
          om_bucket: string | null
          om_partition_schema_version: number | null
          om_passthrough_m: number | null
          om_primary_swell_missing: boolean | null
          om_secondary_swell_missing: boolean | null
          om_tertiary_swell_missing: boolean | null
          om_wind_wave_missing: boolean | null
          predicted_at: string
          raw_display_height_m: number | null
          raw_error_m: number | null
          raw_forecast_m: number | null
          secondary_swell_direction_om: number | null
          secondary_swell_height_om: number | null
          secondary_swell_period_om: number | null
          swell_direction_om: number | null
          swell_height_om: number | null
          swell_period_om: number | null
          swell_wave_peak_period_om: number | null
          tertiary_swell_direction_om: number | null
          tertiary_swell_height_om: number | null
          tertiary_swell_period_om: number | null
          tide_height_m: number | null
          tide_state: string | null
          v5_model_version: string | null
          v5_shadow_height_m: number | null
          wave_direction_deg: number | null
          wave_direction_om: number | null
          wave_height_om: number | null
          wave_peak_period_om: number | null
          wave_period_om: number | null
          wave_period_s: number | null
          wind_direction_deg: number | null
          wind_speed_ms: number | null
          wind_wave_direction_om: number | null
          wind_wave_height_om: number | null
          wind_wave_peak_period_om: number | null
          wind_wave_period_om: number | null
        }
        Insert: {
          beach_id: string
          bias_applied_m?: number | null
          candidate_corrected_m?: number | null
          candidate_model_version?: string | null
          corrected_error_m?: number | null
          corrected_forecast_m?: number | null
          created_at?: string | null
          direction_bucket?: string | null
          display_raw_input_height_m?: number | null
          display_source?: string | null
          display_wave_source?: string | null
          feedback_height_calibration_applied?: boolean
          feedback_height_calibration_candidate_id?: string | null
          feedback_height_offset_ft?: number | null
          forecast_horizon_bucket?: string | null
          forecast_horizon_hours?: number | null
          height_offset_m?: number | null
          height_offset_sample_count?: number | null
          id?: string
          ml_skipped?: boolean
          model_version: string
          noaa_swell_1_direction_deg?: number | null
          noaa_swell_1_height_m?: number | null
          noaa_swell_1_period_s?: number | null
          noaa_swell_2_direction_deg?: number | null
          noaa_swell_2_height_m?: number | null
          noaa_swell_2_period_s?: number | null
          noaa_wind_wave_direction_deg?: number | null
          noaa_wind_wave_height_m?: number | null
          noaa_wind_wave_period_s?: number | null
          observed_m?: number | null
          offset_corrected_display_height_m?: number | null
          om_bucket?: string | null
          om_partition_schema_version?: number | null
          om_passthrough_m?: number | null
          om_primary_swell_missing?: boolean | null
          om_secondary_swell_missing?: boolean | null
          om_tertiary_swell_missing?: boolean | null
          om_wind_wave_missing?: boolean | null
          predicted_at: string
          raw_display_height_m?: number | null
          raw_error_m?: number | null
          raw_forecast_m?: number | null
          secondary_swell_direction_om?: number | null
          secondary_swell_height_om?: number | null
          secondary_swell_period_om?: number | null
          swell_direction_om?: number | null
          swell_height_om?: number | null
          swell_period_om?: number | null
          swell_wave_peak_period_om?: number | null
          tertiary_swell_direction_om?: number | null
          tertiary_swell_height_om?: number | null
          tertiary_swell_period_om?: number | null
          tide_height_m?: number | null
          tide_state?: string | null
          v5_model_version?: string | null
          v5_shadow_height_m?: number | null
          wave_direction_deg?: number | null
          wave_direction_om?: number | null
          wave_height_om?: number | null
          wave_peak_period_om?: number | null
          wave_period_om?: number | null
          wave_period_s?: number | null
          wind_direction_deg?: number | null
          wind_speed_ms?: number | null
          wind_wave_direction_om?: number | null
          wind_wave_height_om?: number | null
          wind_wave_peak_period_om?: number | null
          wind_wave_period_om?: number | null
        }
        Update: {
          beach_id?: string
          bias_applied_m?: number | null
          candidate_corrected_m?: number | null
          candidate_model_version?: string | null
          corrected_error_m?: number | null
          corrected_forecast_m?: number | null
          created_at?: string | null
          direction_bucket?: string | null
          display_raw_input_height_m?: number | null
          display_source?: string | null
          display_wave_source?: string | null
          feedback_height_calibration_applied?: boolean
          feedback_height_calibration_candidate_id?: string | null
          feedback_height_offset_ft?: number | null
          forecast_horizon_bucket?: string | null
          forecast_horizon_hours?: number | null
          height_offset_m?: number | null
          height_offset_sample_count?: number | null
          id?: string
          ml_skipped?: boolean
          model_version?: string
          noaa_swell_1_direction_deg?: number | null
          noaa_swell_1_height_m?: number | null
          noaa_swell_1_period_s?: number | null
          noaa_swell_2_direction_deg?: number | null
          noaa_swell_2_height_m?: number | null
          noaa_swell_2_period_s?: number | null
          noaa_wind_wave_direction_deg?: number | null
          noaa_wind_wave_height_m?: number | null
          noaa_wind_wave_period_s?: number | null
          observed_m?: number | null
          offset_corrected_display_height_m?: number | null
          om_bucket?: string | null
          om_partition_schema_version?: number | null
          om_passthrough_m?: number | null
          om_primary_swell_missing?: boolean | null
          om_secondary_swell_missing?: boolean | null
          om_tertiary_swell_missing?: boolean | null
          om_wind_wave_missing?: boolean | null
          predicted_at?: string
          raw_display_height_m?: number | null
          raw_error_m?: number | null
          raw_forecast_m?: number | null
          secondary_swell_direction_om?: number | null
          secondary_swell_height_om?: number | null
          secondary_swell_period_om?: number | null
          swell_direction_om?: number | null
          swell_height_om?: number | null
          swell_period_om?: number | null
          swell_wave_peak_period_om?: number | null
          tertiary_swell_direction_om?: number | null
          tertiary_swell_height_om?: number | null
          tertiary_swell_period_om?: number | null
          tide_height_m?: number | null
          tide_state?: string | null
          v5_model_version?: string | null
          v5_shadow_height_m?: number | null
          wave_direction_deg?: number | null
          wave_direction_om?: number | null
          wave_height_om?: number | null
          wave_peak_period_om?: number | null
          wave_period_om?: number | null
          wave_period_s?: number | null
          wind_direction_deg?: number | null
          wind_speed_ms?: number | null
          wind_wave_direction_om?: number | null
          wind_wave_height_om?: number | null
          wind_wave_peak_period_om?: number | null
          wind_wave_period_om?: number | null
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
          {
            foreignKeyName: "ml_predictions_log_feedback_height_candidate_fkey"
            columns: ["feedback_height_calibration_candidate_id"]
            isOneToOne: false
            referencedRelation: "beach_feedback_calibration_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      ndbc_direct_observations: {
        Row: {
          created_at: string | null
          id: number
          observed_at: string
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
            foreignKeyName: "ndbc_direct_observations_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "ndbc_direct_stations"
            referencedColumns: ["station_id"]
          },
        ]
      }
      ndbc_direct_stations: {
        Row: {
          active: boolean | null
          coordinates: unknown
          created_at: string | null
          distance_to_beach_km: number | null
          has_wave_data: boolean | null
          ioos_station_id: string | null
          last_seen_at: string | null
          last_wave_fetch_at: string | null
          last_wave_fetch_status: string | null
          last_wave_observed_at: string | null
          latitude: number
          longitude: number
          name: string | null
          nearest_beach_id: string | null
          station_id: string
          station_type: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          coordinates?: unknown
          created_at?: string | null
          distance_to_beach_km?: number | null
          has_wave_data?: boolean | null
          ioos_station_id?: string | null
          last_seen_at?: string | null
          last_wave_fetch_at?: string | null
          last_wave_fetch_status?: string | null
          last_wave_observed_at?: string | null
          latitude: number
          longitude: number
          name?: string | null
          nearest_beach_id?: string | null
          station_id: string
          station_type?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          coordinates?: unknown
          created_at?: string | null
          distance_to_beach_km?: number | null
          has_wave_data?: boolean | null
          ioos_station_id?: string | null
          last_seen_at?: string | null
          last_wave_fetch_at?: string | null
          last_wave_fetch_status?: string | null
          last_wave_observed_at?: string | null
          latitude?: number
          longitude?: number
          name?: string | null
          nearest_beach_id?: string | null
          station_id?: string
          station_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ndbc_direct_stations_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ndbc_direct_stations_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "ndbc_direct_stations_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ndbc_direct_stations_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "ndbc_direct_stations_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "ndbc_direct_stations_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "ndbc_direct_stations_nearest_beach_id_fkey"
            columns: ["nearest_beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
        ]
      }
      notification_delivery_attempts: {
        Row: {
          attempt_number: number
          channel: string
          created_at: string
          error_message: string | null
          id: string
          notification_event_id: string
          provider_response: Json | null
          status: string
        }
        Insert: {
          attempt_number?: number
          channel: string
          created_at?: string
          error_message?: string | null
          id?: string
          notification_event_id: string
          provider_response?: Json | null
          status: string
        }
        Update: {
          attempt_number?: number
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          notification_event_id?: string
          provider_response?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_delivery_attempts_notification_event_id_fkey"
            columns: ["notification_event_id"]
            isOneToOne: false
            referencedRelation: "notification_events"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_delivery_targets: {
        Row: {
          claim_id: string | null
          claim_version: number
          claimed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          installation_id: string
          notification_event_id: string
          provider_response: Json | null
          status: string
          token_fingerprint: string
          updated_at: string
        }
        Insert: {
          claim_id?: string | null
          claim_version?: number
          claimed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          installation_id: string
          notification_event_id: string
          provider_response?: Json | null
          status?: string
          token_fingerprint: string
          updated_at?: string
        }
        Update: {
          claim_id?: string | null
          claim_version?: number
          claimed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          installation_id?: string
          notification_event_id?: string
          provider_response?: Json | null
          status?: string
          token_fingerprint?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_delivery_targets_notification_event_id_fkey"
            columns: ["notification_event_id"]
            isOneToOne: false
            referencedRelation: "notification_events"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events: {
        Row: {
          actor_user_id: string | null
          attempt_count: number
          cancel_reason: string | null
          claim_token: string | null
          claimed_at: string | null
          created_at: string
          dedupe_key: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          last_attempt_at: string | null
          last_error: string | null
          next_attempt_at: string | null
          payload: Json
          processed_at: string | null
          recipient_user_id: string
          skip_reason: string | null
          status: string
          type: string
        }
        Insert: {
          actor_user_id?: string | null
          attempt_count?: number
          cancel_reason?: string | null
          claim_token?: string | null
          claimed_at?: string | null
          created_at?: string
          dedupe_key?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          next_attempt_at?: string | null
          payload?: Json
          processed_at?: string | null
          recipient_user_id: string
          skip_reason?: string | null
          status?: string
          type: string
        }
        Update: {
          actor_user_id?: string | null
          attempt_count?: number
          cancel_reason?: string | null
          claim_token?: string | null
          claimed_at?: string | null
          created_at?: string
          dedupe_key?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          next_attempt_at?: string | null
          payload?: Json
          processed_at?: string | null
          recipient_user_id?: string
          skip_reason?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notification_events_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notification_send_log: {
        Row: {
          beach_id: string
          created_at: string
          id: string
          local_forecast_date: string
          notification_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          beach_id: string
          created_at?: string
          id?: string
          local_forecast_date: string
          notification_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          beach_id?: string
          created_at?: string
          id?: string
          local_forecast_date?: string
          notification_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_send_log_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_send_log_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "notification_send_log_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_send_log_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "notification_send_log_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "notification_send_log_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "notification_send_log_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "notification_send_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
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
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
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
      pending_alert_captures: {
        Row: {
          beach_id: string
          captured_at: string
          consumed_at: string | null
          consumed_user_id: string | null
          email: string
          expires_at: string
          id: string
          preset_type: string
          return_path: string
        }
        Insert: {
          beach_id: string
          captured_at?: string
          consumed_at?: string | null
          consumed_user_id?: string | null
          email: string
          expires_at?: string
          id?: string
          preset_type: string
          return_path: string
        }
        Update: {
          beach_id?: string
          captured_at?: string
          consumed_at?: string | null
          consumed_user_id?: string | null
          email?: string
          expires_at?: string
          id?: string
          preset_type?: string
          return_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_alert_captures_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_alert_captures_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "pending_alert_captures_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_alert_captures_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "pending_alert_captures_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "pending_alert_captures_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "pending_alert_captures_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "pending_alert_captures_consumed_user_id_fkey"
            columns: ["consumed_user_id"]
            isOneToOne: false
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "pending_alert_captures_consumed_user_id_fkey"
            columns: ["consumed_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_alert_captures_consumed_user_id_fkey"
            columns: ["consumed_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_alert_captures_consumed_user_id_fkey"
            columns: ["consumed_user_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "personalization_milestones_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
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
          analytics_exclusion_reason: string | null
          analytics_is_real_user: boolean
          android_waitlist_joined_at: string | null
          android_waitlist_placement: string | null
          android_waitlist_source: string | null
          android_waitlist_surface: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          crowd_tolerance: string | null
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
          max_drive_minutes: number | null
          notif_email_enabled: boolean
          notif_follows: boolean
          notif_forecast_alerts: boolean
          notif_inapp_enabled: boolean
          notif_likes: boolean
          notif_push_enabled: boolean
          notif_reminders: boolean
          notif_session_invites: boolean
          notif_similarity_alerts: boolean
          notif_water_quality: boolean
          notif_xp_updates: boolean
          onboarding_completed_at: string | null
          paywall_soft_prompt_shown: boolean
          personality_type: string | null
          phone_number: string | null
          posting_window: Json | null
          preferences_v2_shown_at: string | null
          preferred_session_time: string | null
          preferred_wave_size: string | null
          referral_code: string | null
          signup_context: Json | null
          signup_location: Json | null
          sound_effects_enabled: boolean
          surf_styles: string[] | null
          tide_comfort: string | null
          timezone: string | null
          trust_score: number
          updated_at: string | null
          wants_android_access: boolean
          wind_comfort: string | null
        }
        Insert: {
          activity_level?: string | null
          allow_implicit_tracking?: boolean
          analytics_exclusion_reason?: string | null
          analytics_is_real_user?: boolean
          android_waitlist_joined_at?: string | null
          android_waitlist_placement?: string | null
          android_waitlist_source?: string | null
          android_waitlist_surface?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          crowd_tolerance?: string | null
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
          max_drive_minutes?: number | null
          notif_email_enabled?: boolean
          notif_follows?: boolean
          notif_forecast_alerts?: boolean
          notif_inapp_enabled?: boolean
          notif_likes?: boolean
          notif_push_enabled?: boolean
          notif_reminders?: boolean
          notif_session_invites?: boolean
          notif_similarity_alerts?: boolean
          notif_water_quality?: boolean
          notif_xp_updates?: boolean
          onboarding_completed_at?: string | null
          paywall_soft_prompt_shown?: boolean
          personality_type?: string | null
          phone_number?: string | null
          posting_window?: Json | null
          preferences_v2_shown_at?: string | null
          preferred_session_time?: string | null
          preferred_wave_size?: string | null
          referral_code?: string | null
          signup_context?: Json | null
          signup_location?: Json | null
          sound_effects_enabled?: boolean
          surf_styles?: string[] | null
          tide_comfort?: string | null
          timezone?: string | null
          trust_score?: number
          updated_at?: string | null
          wants_android_access?: boolean
          wind_comfort?: string | null
        }
        Update: {
          activity_level?: string | null
          allow_implicit_tracking?: boolean
          analytics_exclusion_reason?: string | null
          analytics_is_real_user?: boolean
          android_waitlist_joined_at?: string | null
          android_waitlist_placement?: string | null
          android_waitlist_source?: string | null
          android_waitlist_surface?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          crowd_tolerance?: string | null
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
          max_drive_minutes?: number | null
          notif_email_enabled?: boolean
          notif_follows?: boolean
          notif_forecast_alerts?: boolean
          notif_inapp_enabled?: boolean
          notif_likes?: boolean
          notif_push_enabled?: boolean
          notif_reminders?: boolean
          notif_session_invites?: boolean
          notif_similarity_alerts?: boolean
          notif_water_quality?: boolean
          notif_xp_updates?: boolean
          onboarding_completed_at?: string | null
          paywall_soft_prompt_shown?: boolean
          personality_type?: string | null
          phone_number?: string | null
          posting_window?: Json | null
          preferences_v2_shown_at?: string | null
          preferred_session_time?: string | null
          preferred_wave_size?: string | null
          referral_code?: string | null
          signup_context?: Json | null
          signup_location?: Json | null
          sound_effects_enabled?: boolean
          surf_styles?: string[] | null
          tide_comfort?: string | null
          timezone?: string | null
          trust_score?: number
          updated_at?: string | null
          wants_android_access?: boolean
          wind_comfort?: string | null
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
      qr_business_venues: {
        Row: {
          activated_at: string | null
          activation_threshold: number
          admin_visible: boolean
          claimed_user_id: string | null
          created_at: string
          id: string
          lat: number
          lon: number
          name: string
          qr_scan_count: number
        }
        Insert: {
          activated_at?: string | null
          activation_threshold?: number
          admin_visible?: boolean
          claimed_user_id?: string | null
          created_at?: string
          id?: string
          lat: number
          lon: number
          name: string
          qr_scan_count?: number
        }
        Update: {
          activated_at?: string | null
          activation_threshold?: number
          admin_visible?: boolean
          claimed_user_id?: string | null
          created_at?: string
          id?: string
          lat?: number
          lon?: number
          name?: string
          qr_scan_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "qr_business_venues_claimed_user_id_fkey"
            columns: ["claimed_user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      recommendation_impressions: {
        Row: {
          beach_id: string
          created_at: string
          id: string
          impression_key: string
          mode: string
          rank: number
          recommendation_id: string
          score: number | null
          surface: string
          time_slot: string | null
          user_id: string
          window_end: string
          window_start: string
        }
        Insert: {
          beach_id: string
          created_at?: string
          id?: string
          impression_key: string
          mode?: string
          rank: number
          recommendation_id: string
          score?: number | null
          surface: string
          time_slot?: string | null
          user_id: string
          window_end: string
          window_start: string
        }
        Update: {
          beach_id?: string
          created_at?: string
          id?: string
          impression_key?: string
          mode?: string
          rank?: number
          recommendation_id?: string
          score?: number | null
          surface?: string
          time_slot?: string | null
          user_id?: string
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_impressions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_impressions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "recommendation_impressions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_impressions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "recommendation_impressions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "recommendation_impressions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "recommendation_impressions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "recommendation_impressions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      recommendation_session_contexts: {
        Row: {
          beach_id: string | null
          beach_name: string | null
          condition_score: number
          created_at: string
          fallback_horizon_hours: number | null
          forecast_at: string | null
          id: string
          overall_score: number
          personal_match_score: number
          ranking_position: number
          reason_type: string
          recommendation_id: string
          recommendation_state: string
          session_id: string
          source_surface: string
          user_id: string
          window_end: string
          window_start: string
        }
        Insert: {
          beach_id?: string | null
          beach_name?: string | null
          condition_score: number
          created_at?: string
          fallback_horizon_hours?: number | null
          forecast_at?: string | null
          id?: string
          overall_score: number
          personal_match_score: number
          ranking_position: number
          reason_type: string
          recommendation_id: string
          recommendation_state: string
          session_id: string
          source_surface: string
          user_id: string
          window_end: string
          window_start: string
        }
        Update: {
          beach_id?: string | null
          beach_name?: string | null
          condition_score?: number
          created_at?: string
          fallback_horizon_hours?: number | null
          forecast_at?: string | null
          id?: string
          overall_score?: number
          personal_match_score?: number
          ranking_position?: number
          reason_type?: string
          recommendation_id?: string
          recommendation_state?: string
          session_id?: string
          source_surface?: string
          user_id?: string
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_session_contexts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_session_contexts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "recommendation_session_contexts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_session_contexts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "recommendation_session_contexts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "recommendation_session_contexts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "recommendation_session_contexts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "recommendation_session_contexts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "public_session_feed_eligibility"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "recommendation_session_contexts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "recommendation_feedback_summary"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "recommendation_session_contexts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["first_session_id"]
          },
          {
            foreignKeyName: "recommendation_session_contexts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["second_session_within_14d_id"]
          },
          {
            foreignKeyName: "recommendation_session_contexts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_session_contexts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
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
          source: string
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
          source?: string
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
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: true
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
          },
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
            foreignKeyName: "referrals_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: true
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
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
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
          },
        ]
      }
      regional_recommendation_hold_operator_refs: {
        Row: {
          created_at: string
          operator_ref: string
          operator_user_id: string
        }
        Insert: {
          created_at?: string
          operator_ref?: string
          operator_user_id: string
        }
        Update: {
          created_at?: string
          operator_ref?: string
          operator_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "regional_recommendation_hold_operator_ref_operator_user_id_fkey"
            columns: ["operator_user_id"]
            isOneToOne: true
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      regional_recommendation_holds: {
        Row: {
          action: string
          affected_cohorts: string[]
          authorizing_actor: string
          authorizing_operator_ref: string | null
          automatic_policy_version: string | null
          created_at: string
          effective_at: string
          event_reference: string | null
          expires_at: string
          hold_id: string
          idempotency_key: string
          payload_hash: string
          protected_alternative_beach_ids: string[]
          reason_code: string
          record_id: string
          region_keys: string[]
          request_id: string | null
          scope_beach_ids: string[]
          scope_exposure_classes: string[]
          status: string
          supersedes_record_id: string | null
          supporting_evidence_refs: Json
          transition: string
          trigger_type: string
          valid_from: string
          valid_until: string
          version: number
        }
        Insert: {
          action: string
          affected_cohorts: string[]
          authorizing_actor: string
          authorizing_operator_ref?: string | null
          automatic_policy_version?: string | null
          created_at?: string
          effective_at: string
          event_reference?: string | null
          expires_at: string
          hold_id: string
          idempotency_key: string
          payload_hash: string
          protected_alternative_beach_ids?: string[]
          reason_code: string
          record_id?: string
          region_keys?: string[]
          request_id?: string | null
          scope_beach_ids: string[]
          scope_exposure_classes?: string[]
          status: string
          supersedes_record_id?: string | null
          supporting_evidence_refs?: Json
          transition: string
          trigger_type: string
          valid_from: string
          valid_until: string
          version: number
        }
        Update: {
          action?: string
          affected_cohorts?: string[]
          authorizing_actor?: string
          authorizing_operator_ref?: string | null
          automatic_policy_version?: string | null
          created_at?: string
          effective_at?: string
          event_reference?: string | null
          expires_at?: string
          hold_id?: string
          idempotency_key?: string
          payload_hash?: string
          protected_alternative_beach_ids?: string[]
          reason_code?: string
          record_id?: string
          region_keys?: string[]
          request_id?: string | null
          scope_beach_ids?: string[]
          scope_exposure_classes?: string[]
          status?: string
          supersedes_record_id?: string | null
          supporting_evidence_refs?: Json
          transition?: string
          trigger_type?: string
          valid_from?: string
          valid_until?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "regional_recommendation_holds_supersedes_record_id_fkey"
            columns: ["supersedes_record_id"]
            isOneToOne: true
            referencedRelation: "regional_recommendation_holds"
            referencedColumns: ["record_id"]
          },
        ]
      }
      rip_current_risks: {
        Row: {
          beach_id: string
          created_at: string
          fetched_at: string
          id: string
          raw_zone: string | null
          risk_level: string
          source: string
          updated_at: string
          valid_date: string
        }
        Insert: {
          beach_id: string
          created_at?: string
          fetched_at?: string
          id?: string
          raw_zone?: string | null
          risk_level: string
          source: string
          updated_at?: string
          valid_date: string
        }
        Update: {
          beach_id?: string
          created_at?: string
          fetched_at?: string
          id?: string
          raw_zone?: string | null
          risk_level?: string
          source?: string
          updated_at?: string
          valid_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "rip_current_risks_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rip_current_risks_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "rip_current_risks_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rip_current_risks_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "rip_current_risks_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "rip_current_risks_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "rip_current_risks_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
        ]
      }
      roadmap_item_submissions: {
        Row: {
          category: Database["public"]["Enums"]["roadmap_category"]
          created_at: string
          decision: Database["public"]["Enums"]["roadmap_submission_decision"]
          description: string
          founder_reply: string | null
          id: string
          merged_into_item_id: string | null
          submitter_user_id: string
          title: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["roadmap_category"]
          created_at?: string
          decision?: Database["public"]["Enums"]["roadmap_submission_decision"]
          description: string
          founder_reply?: string | null
          id?: string
          merged_into_item_id?: string | null
          submitter_user_id: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["roadmap_category"]
          created_at?: string
          decision?: Database["public"]["Enums"]["roadmap_submission_decision"]
          description?: string
          founder_reply?: string | null
          id?: string
          merged_into_item_id?: string | null
          submitter_user_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_item_submissions_merged_into_item_id_fkey"
            columns: ["merged_into_item_id"]
            isOneToOne: false
            referencedRelation: "roadmap_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roadmap_item_submissions_merged_into_item_id_fkey"
            columns: ["merged_into_item_id"]
            isOneToOne: false
            referencedRelation: "roadmap_items_with_vote_count"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roadmap_item_submissions_submitter_user_id_fkey"
            columns: ["submitter_user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      roadmap_items: {
        Row: {
          category: Database["public"]["Enums"]["roadmap_category"]
          created_at: string
          description: string
          eta_label: string | null
          founder_reply: string | null
          id: string
          shipped_at: string | null
          status: Database["public"]["Enums"]["roadmap_status"]
          title: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["roadmap_category"]
          created_at?: string
          description: string
          eta_label?: string | null
          founder_reply?: string | null
          id?: string
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["roadmap_status"]
          title: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["roadmap_category"]
          created_at?: string
          description?: string
          eta_label?: string | null
          founder_reply?: string | null
          id?: string
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["roadmap_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      roadmap_votes: {
        Row: {
          created_at: string
          item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_votes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "roadmap_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roadmap_votes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "roadmap_items_with_vote_count"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roadmap_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
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
          {
            foreignKeyName: "saved_windows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
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
            referencedRelation: "public_session_feed_eligibility"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_forecast_snapshots_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "recommendation_feedback_summary"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_forecast_snapshots_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "session_activation_report"
            referencedColumns: ["first_session_id"]
          },
          {
            foreignKeyName: "session_forecast_snapshots_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "session_activation_report"
            referencedColumns: ["second_session_within_14d_id"]
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
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
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
          {
            foreignKeyName: "session_forecast_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
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
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
          },
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
            foreignKeyName: "session_invitations_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "session_invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
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
            foreignKeyName: "session_invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "session_invitations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "public_session_feed_eligibility"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_invitations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "recommendation_feedback_summary"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_invitations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["first_session_id"]
          },
          {
            foreignKeyName: "session_invitations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["second_session_within_14d_id"]
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
            referencedRelation: "public_session_feed_eligibility"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_likes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "recommendation_feedback_summary"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_likes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["first_session_id"]
          },
          {
            foreignKeyName: "session_likes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["second_session_within_14d_id"]
          },
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
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
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
          {
            foreignKeyName: "session_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
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
          {
            foreignKeyName: "session_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
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
          moderation_reason: string | null
          moderation_status: string
          public_url: string
          session_id: string | null
          storage_path: string
          thumbnail_path: string | null
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
          moderation_reason?: string | null
          moderation_status?: string
          public_url: string
          session_id?: string | null
          storage_path: string
          thumbnail_path?: string | null
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
          moderation_reason?: string | null
          moderation_status?: string
          public_url?: string
          session_id?: string | null
          storage_path?: string
          thumbnail_path?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_media_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "public_session_feed_eligibility"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_media_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "recommendation_feedback_summary"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_media_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["first_session_id"]
          },
          {
            foreignKeyName: "session_media_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["second_session_within_14d_id"]
          },
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
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
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
          {
            foreignKeyName: "session_media_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
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
          moderation_reason: string | null
          moderation_status: string | null
          public_url: string | null
          session_id: string | null
          storage_path: string | null
          thumbnail_path: string | null
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
          moderation_reason?: string | null
          moderation_status?: string | null
          public_url?: string | null
          session_id?: string | null
          storage_path?: string | null
          thumbnail_path?: string | null
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
          moderation_reason?: string | null
          moderation_status?: string | null
          public_url?: string | null
          session_id?: string | null
          storage_path?: string | null
          thumbnail_path?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_media_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
          },
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
          {
            foreignKeyName: "session_media_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
          },
        ]
      }
      session_share_links: {
        Row: {
          created_at: string
          platform: string
          session_id: string
          share_id: string
          share_url: string
          surface: string
          user_id: string
        }
        Insert: {
          created_at?: string
          platform: string
          session_id: string
          share_id?: string
          share_url: string
          surface?: string
          user_id: string
        }
        Update: {
          created_at?: string
          platform?: string
          session_id?: string
          share_id?: string
          share_url?: string
          surface?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_share_links_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "public_session_feed_eligibility"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_share_links_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "recommendation_feedback_summary"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_share_links_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["first_session_id"]
          },
          {
            foreignKeyName: "session_share_links_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["second_session_within_14d_id"]
          },
          {
            foreignKeyName: "session_share_links_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_share_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "session_share_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_share_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_share_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
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
            referencedRelation: "public_session_feed_eligibility"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_shares_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "recommendation_feedback_summary"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_shares_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["first_session_id"]
          },
          {
            foreignKeyName: "session_shares_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["second_session_within_14d_id"]
          },
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
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
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
          {
            foreignKeyName: "session_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
          },
        ]
      }
      session_wave_observation_candidates: {
        Row: {
          beach_id: string | null
          created_at: string
          forecast_horizon_hours: number | null
          id: string
          matched_prediction_at: string | null
          ml_prediction_id: string | null
          nearest_prediction_delta_minutes: number | null
          observation_source: string
          observation_weight: number
          observed_at: string | null
          observed_m: number | null
          quality_state: string
          rejection_reason: string | null
          reported_wave_height_ft: number | null
          session_id: string
          snapshot_buoy_observed_m: number | null
          snapshot_candidate_model_version: string | null
          snapshot_corrected_forecast_m: number | null
          snapshot_display_height_m: number | null
          snapshot_display_source: string | null
          snapshot_model_version: string | null
          snapshot_raw_forecast_m: number | null
          snapshot_raw_om_height_m: number | null
          snapshot_v5_model_version: string | null
          snapshot_v5_shadow_height_m: number | null
          source_created_by: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          beach_id?: string | null
          created_at?: string
          forecast_horizon_hours?: number | null
          id?: string
          matched_prediction_at?: string | null
          ml_prediction_id?: string | null
          nearest_prediction_delta_minutes?: number | null
          observation_source?: string
          observation_weight?: number
          observed_at?: string | null
          observed_m?: number | null
          quality_state?: string
          rejection_reason?: string | null
          reported_wave_height_ft?: number | null
          session_id: string
          snapshot_buoy_observed_m?: number | null
          snapshot_candidate_model_version?: string | null
          snapshot_corrected_forecast_m?: number | null
          snapshot_display_height_m?: number | null
          snapshot_display_source?: string | null
          snapshot_model_version?: string | null
          snapshot_raw_forecast_m?: number | null
          snapshot_raw_om_height_m?: number | null
          snapshot_v5_model_version?: string | null
          snapshot_v5_shadow_height_m?: number | null
          source_created_by?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          beach_id?: string | null
          created_at?: string
          forecast_horizon_hours?: number | null
          id?: string
          matched_prediction_at?: string | null
          ml_prediction_id?: string | null
          nearest_prediction_delta_minutes?: number | null
          observation_source?: string
          observation_weight?: number
          observed_at?: string | null
          observed_m?: number | null
          quality_state?: string
          rejection_reason?: string | null
          reported_wave_height_ft?: number | null
          session_id?: string
          snapshot_buoy_observed_m?: number | null
          snapshot_candidate_model_version?: string | null
          snapshot_corrected_forecast_m?: number | null
          snapshot_display_height_m?: number | null
          snapshot_display_source?: string | null
          snapshot_model_version?: string | null
          snapshot_raw_forecast_m?: number | null
          snapshot_raw_om_height_m?: number | null
          snapshot_v5_model_version?: string | null
          snapshot_v5_shadow_height_m?: number | null
          source_created_by?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_wave_observation_candidates_ml_prediction_id_fkey"
            columns: ["ml_prediction_id"]
            isOneToOne: false
            referencedRelation: "ml_predictions_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_wave_observation_candidates_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "public_session_feed_eligibility"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_wave_observation_candidates_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "recommendation_feedback_summary"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_wave_observation_candidates_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "session_activation_report"
            referencedColumns: ["first_session_id"]
          },
          {
            foreignKeyName: "session_wave_observation_candidates_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "session_activation_report"
            referencedColumns: ["second_session_within_14d_id"]
          },
          {
            foreignKeyName: "session_wave_observation_candidates_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          arrival_time: string
          beach_id: string
          beach_name: string | null
          board_fit: string | null
          board_id: string | null
          board_snapshot: Json | null
          comments_count: number
          created_at: string
          crowd_level: number | null
          custom_spot_id: string | null
          deleted_at: string | null
          description: string | null
          duration_minutes: number
          forecast_accuracy: string | null
          forecast_tide_status: string | null
          forecast_wave_height_ft: number | null
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
          recommendation_call_accuracy: string | null
          recommendation_id: string | null
          rip_current_observed: string | null
          rip_current_risk: string | null
          session_board_fit: string | null
          session_decomposition: Json | null
          session_skill_fit: string | null
          share_count: number
          skill_ratings: Json | null
          source: string | null
          status: string | null
          tide_data_source: string | null
          tide_height_ft: number | null
          tide_rate_ft_per_hr: number | null
          tide_status: string | null
          tide_status_correct: boolean | null
          user_id: string
          water_temp: number | null
          wave_characteristics: string[] | null
          wave_height_correct: boolean | null
          wave_height_ft: number | null
          wave_quality: number | null
          wind_direction: string | null
          wind_speed_mph: number | null
        }
        Insert: {
          arrival_time?: string
          beach_id: string
          beach_name?: string | null
          board_fit?: string | null
          board_id?: string | null
          board_snapshot?: Json | null
          comments_count?: number
          created_at?: string
          crowd_level?: number | null
          custom_spot_id?: string | null
          deleted_at?: string | null
          description?: string | null
          duration_minutes?: number
          forecast_accuracy?: string | null
          forecast_tide_status?: string | null
          forecast_wave_height_ft?: number | null
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
          recommendation_call_accuracy?: string | null
          recommendation_id?: string | null
          rip_current_observed?: string | null
          rip_current_risk?: string | null
          session_board_fit?: string | null
          session_decomposition?: Json | null
          session_skill_fit?: string | null
          share_count?: number
          skill_ratings?: Json | null
          source?: string | null
          status?: string | null
          tide_data_source?: string | null
          tide_height_ft?: number | null
          tide_rate_ft_per_hr?: number | null
          tide_status?: string | null
          tide_status_correct?: boolean | null
          user_id: string
          water_temp?: number | null
          wave_characteristics?: string[] | null
          wave_height_correct?: boolean | null
          wave_height_ft?: number | null
          wave_quality?: number | null
          wind_direction?: string | null
          wind_speed_mph?: number | null
        }
        Update: {
          arrival_time?: string
          beach_id?: string
          beach_name?: string | null
          board_fit?: string | null
          board_id?: string | null
          board_snapshot?: Json | null
          comments_count?: number
          created_at?: string
          crowd_level?: number | null
          custom_spot_id?: string | null
          deleted_at?: string | null
          description?: string | null
          duration_minutes?: number
          forecast_accuracy?: string | null
          forecast_tide_status?: string | null
          forecast_wave_height_ft?: number | null
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
          recommendation_call_accuracy?: string | null
          recommendation_id?: string | null
          rip_current_observed?: string | null
          rip_current_risk?: string | null
          session_board_fit?: string | null
          session_decomposition?: Json | null
          session_skill_fit?: string | null
          share_count?: number
          skill_ratings?: Json | null
          source?: string | null
          status?: string | null
          tide_data_source?: string | null
          tide_height_ft?: number | null
          tide_rate_ft_per_hr?: number | null
          tide_status?: string | null
          tide_status_correct?: boolean | null
          user_id?: string
          water_temp?: number | null
          wave_characteristics?: string[] | null
          wave_height_correct?: boolean | null
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
            foreignKeyName: "sessions_custom_spot_id_fkey"
            columns: ["custom_spot_id"]
            isOneToOne: false
            referencedRelation: "custom_spots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
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
          {
            foreignKeyName: "sessions_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
          },
        ]
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
          {
            foreignKeyName: "spot_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
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
      storage_usage: {
        Row: {
          image_count: number
          last_updated: string
          total_bytes: number
          user_id: string
        }
        Insert: {
          image_count?: number
          last_updated?: string
          total_bytes?: number
          user_id: string
        }
        Update: {
          image_count?: number
          last_updated?: string
          total_bytes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "storage_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "storage_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
          },
        ]
      }
      streak_reminder_log: {
        Row: {
          period_key: string
          reminder_type: string
          sent_at: string
          user_id: string
        }
        Insert: {
          period_key: string
          reminder_type: string
          sent_at?: string
          user_id: string
        }
        Update: {
          period_key?: string
          reminder_type?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streak_reminder_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
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
      surf_alert_delivery_slots: {
        Row: {
          alert_date: string
          beach_id: string
          created_at: string
          priority: number
          recipient_user_id: string
          updated_at: string
          winner_notification_event_id: string
        }
        Insert: {
          alert_date: string
          beach_id: string
          created_at?: string
          priority: number
          recipient_user_id: string
          updated_at?: string
          winner_notification_event_id: string
        }
        Update: {
          alert_date?: string
          beach_id?: string
          created_at?: string
          priority?: number
          recipient_user_id?: string
          updated_at?: string
          winner_notification_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "surf_alert_delivery_slots_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "surf_alert_delivery_slots_winner_notification_event_id_fkey"
            columns: ["winner_notification_event_id"]
            isOneToOne: false
            referencedRelation: "notification_events"
            referencedColumns: ["id"]
          },
        ]
      }
      surf_drop_link_grants: {
        Row: {
          drop_id: string
          granted_at: string
          user_id: string
        }
        Insert: {
          drop_id: string
          granted_at?: string
          user_id: string
        }
        Update: {
          drop_id?: string
          granted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "surf_drop_link_grants_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "surf_drops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surf_drop_link_grants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      surf_drop_participants: {
        Row: {
          drop_id: string
          joined_at: string
          left_at: string | null
          user_id: string
        }
        Insert: {
          drop_id: string
          joined_at?: string
          left_at?: string | null
          user_id: string
        }
        Update: {
          drop_id?: string
          joined_at?: string
          left_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "surf_drop_participants_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "surf_drops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surf_drop_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      surf_drops: {
        Row: {
          audience: Database["public"]["Enums"]["surf_drop_audience"]
          beach_id: string | null
          cancelled_at: string | null
          created_at: string
          custom_lat: number | null
          custom_lon: number | null
          deleted_at: string | null
          ends_at: string
          exact_label: string | null
          forecast_snapshot: Json | null
          general_area: string | null
          id: string
          location_type: string
          note: string | null
          share_slug: string
          starts_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audience?: Database["public"]["Enums"]["surf_drop_audience"]
          beach_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          custom_lat?: number | null
          custom_lon?: number | null
          deleted_at?: string | null
          ends_at: string
          exact_label?: string | null
          forecast_snapshot?: Json | null
          general_area?: string | null
          id?: string
          location_type: string
          note?: string | null
          share_slug?: string
          starts_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["surf_drop_audience"]
          beach_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          custom_lat?: number | null
          custom_lon?: number | null
          deleted_at?: string | null
          ends_at?: string
          exact_label?: string | null
          forecast_snapshot?: Json | null
          general_area?: string | null
          id?: string
          location_type?: string
          note?: string | null
          share_slug?: string
          starts_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "surf_drops_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surf_drops_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "surf_drops_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surf_drops_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "surf_drops_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "surf_drops_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "surf_drops_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "surf_drops_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      surfline_shadow_forecasts: {
        Row: {
          beach_id: string
          fetched_at: string | null
          forecast_ts: string
          id: string
          surfline_spot_id: string
          wave_height_max_m: number | null
          wave_height_min_m: number | null
        }
        Insert: {
          beach_id: string
          fetched_at?: string | null
          forecast_ts: string
          id?: string
          surfline_spot_id: string
          wave_height_max_m?: number | null
          wave_height_min_m?: number | null
        }
        Update: {
          beach_id?: string
          fetched_at?: string | null
          forecast_ts?: string
          id?: string
          surfline_spot_id?: string
          wave_height_max_m?: number | null
          wave_height_min_m?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "surfline_shadow_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surfline_shadow_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "surfline_shadow_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surfline_shadow_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "surfline_shadow_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "surfline_shadow_forecasts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "surfline_shadow_forecasts_beach_id_fkey"
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
          station_id: string | null
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
          station_id?: string | null
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
          station_id?: string | null
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
      trial_ending_push_log: {
        Row: {
          meta: Json
          sent_at: string
          trial_ends_at: string | null
          user_id: string
        }
        Insert: {
          meta?: Json
          sent_at?: string
          trial_ends_at?: string | null
          user_id: string
        }
        Update: {
          meta?: Json
          sent_at?: string
          trial_ends_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_ending_push_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      trusted_forecast_alerts: {
        Row: {
          acknowledged: boolean
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_code: string
          alert_id: string
          beach_id: string
          build_key: string
          conflicting_issue_id: string | null
          created_at: string
          decision_id: string | null
          evidence: Json
          local_date: string
          primary_issue_id: string | null
          separation_ft: number
        }
        Insert: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_code: string
          alert_id?: string
          beach_id: string
          build_key: string
          conflicting_issue_id?: string | null
          created_at?: string
          decision_id?: string | null
          evidence?: Json
          local_date: string
          primary_issue_id?: string | null
          separation_ft: number
        }
        Update: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_code?: string
          alert_id?: string
          beach_id?: string
          build_key?: string
          conflicting_issue_id?: string | null
          created_at?: string
          decision_id?: string | null
          evidence?: Json
          local_date?: string
          primary_issue_id?: string | null
          separation_ft?: number
        }
        Relationships: [
          {
            foreignKeyName: "trusted_forecast_alerts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trusted_forecast_alerts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "trusted_forecast_alerts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trusted_forecast_alerts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "trusted_forecast_alerts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "trusted_forecast_alerts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "trusted_forecast_alerts_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "trusted_forecast_alerts_conflicting_issue_id_fkey"
            columns: ["conflicting_issue_id"]
            isOneToOne: false
            referencedRelation: "trusted_forecast_issues"
            referencedColumns: ["issue_id"]
          },
          {
            foreignKeyName: "trusted_forecast_alerts_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "trusted_forecast_decisions"
            referencedColumns: ["decision_id"]
          },
          {
            foreignKeyName: "trusted_forecast_alerts_primary_issue_id_fkey"
            columns: ["primary_issue_id"]
            isOneToOne: false
            referencedRelation: "trusted_forecast_issues"
            referencedColumns: ["issue_id"]
          },
        ]
      }
      trusted_forecast_applications: {
        Row: {
          adjusted_max_face_ft: number | null
          application_id: string
          applied_delta_ft: number
          baseline_max_face_ft: number | null
          beach_id: string
          build_key: string
          created_at: string
          decision_id: string
          forecast_at: string
          prediction_snapshot_id: string | null
        }
        Insert: {
          adjusted_max_face_ft?: number | null
          application_id?: string
          applied_delta_ft: number
          baseline_max_face_ft?: number | null
          beach_id: string
          build_key: string
          created_at?: string
          decision_id: string
          forecast_at: string
          prediction_snapshot_id?: string | null
        }
        Update: {
          adjusted_max_face_ft?: number | null
          application_id?: string
          applied_delta_ft?: number
          baseline_max_face_ft?: number | null
          beach_id?: string
          build_key?: string
          created_at?: string
          decision_id?: string
          forecast_at?: string
          prediction_snapshot_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trusted_forecast_applications_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trusted_forecast_applications_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "trusted_forecast_applications_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trusted_forecast_applications_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "trusted_forecast_applications_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "trusted_forecast_applications_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "trusted_forecast_applications_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "trusted_forecast_applications_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "trusted_forecast_decisions"
            referencedColumns: ["decision_id"]
          },
          {
            foreignKeyName: "trusted_forecast_applications_prediction_snapshot_id_fkey"
            columns: ["prediction_snapshot_id"]
            isOneToOne: false
            referencedRelation: "ml_predictions_log"
            referencedColumns: ["id"]
          },
        ]
      }
      trusted_forecast_build_receipts: {
        Row: {
          build_anchor_at: string
          build_key: string
          committed_at: string
          created_at: string
          durable_alert_count: number
          expected_alert_count: number
          expected_application_count: number
          expected_decision_count: number
          expected_snapshot_count: number
          inserted_alert_count: number
          inserted_application_count: number
          inserted_decision_count: number
          inserted_snapshot_count: number
          payload_sha256: string
          policy_version: string
          receipt_id: string
          reused_alert_count: number
          reused_application_count: number
          reused_decision_count: number
          reused_snapshot_count: number
          schema_version: string
        }
        Insert: {
          build_anchor_at: string
          build_key: string
          committed_at?: string
          created_at?: string
          durable_alert_count: number
          expected_alert_count: number
          expected_application_count: number
          expected_decision_count: number
          expected_snapshot_count: number
          inserted_alert_count: number
          inserted_application_count: number
          inserted_decision_count: number
          inserted_snapshot_count: number
          payload_sha256: string
          policy_version: string
          receipt_id?: string
          reused_alert_count: number
          reused_application_count: number
          reused_decision_count: number
          reused_snapshot_count: number
          schema_version: string
        }
        Update: {
          build_anchor_at?: string
          build_key?: string
          committed_at?: string
          created_at?: string
          durable_alert_count?: number
          expected_alert_count?: number
          expected_application_count?: number
          expected_decision_count?: number
          expected_snapshot_count?: number
          inserted_alert_count?: number
          inserted_application_count?: number
          inserted_decision_count?: number
          inserted_snapshot_count?: number
          payload_sha256?: string
          policy_version?: string
          receipt_id?: string
          reused_alert_count?: number
          reused_application_count?: number
          reused_decision_count?: number
          reused_snapshot_count?: number
          schema_version?: string
        }
        Relationships: []
      }
      trusted_forecast_decisions: {
        Row: {
          applied_delta_ft: number
          baseline_max_face_ft: number | null
          beach_id: string
          build_key: string
          created_at: string
          decided_at: string
          decision_id: string
          local_date: string
          local_timezone: string
          policy_version: string
          primary_issue_id: string | null
          signed_gap_ft: number | null
          status: string
          trusted_max_face_ft: number | null
          trusted_min_face_ft: number | null
        }
        Insert: {
          applied_delta_ft?: number
          baseline_max_face_ft?: number | null
          beach_id: string
          build_key: string
          created_at?: string
          decided_at?: string
          decision_id?: string
          local_date: string
          local_timezone: string
          policy_version: string
          primary_issue_id?: string | null
          signed_gap_ft?: number | null
          status: string
          trusted_max_face_ft?: number | null
          trusted_min_face_ft?: number | null
        }
        Update: {
          applied_delta_ft?: number
          baseline_max_face_ft?: number | null
          beach_id?: string
          build_key?: string
          created_at?: string
          decided_at?: string
          decision_id?: string
          local_date?: string
          local_timezone?: string
          policy_version?: string
          primary_issue_id?: string | null
          signed_gap_ft?: number | null
          status?: string
          trusted_max_face_ft?: number | null
          trusted_min_face_ft?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trusted_forecast_decisions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trusted_forecast_decisions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "trusted_forecast_decisions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trusted_forecast_decisions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "trusted_forecast_decisions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "trusted_forecast_decisions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "trusted_forecast_decisions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "trusted_forecast_decisions_primary_issue_id_fkey"
            columns: ["primary_issue_id"]
            isOneToOne: false
            referencedRelation: "trusted_forecast_issues"
            referencedColumns: ["issue_id"]
          },
        ]
      }
      trusted_forecast_ingest_runs: {
        Row: {
          created_at: string
          failed_count: number
          finished_at: string
          healthy: boolean
          ingest_run_id: string
          issue_count: number
          ok_count: number
          source_count: number
          started_at: string
        }
        Insert: {
          created_at?: string
          failed_count: number
          finished_at: string
          healthy: boolean
          ingest_run_id: string
          issue_count: number
          ok_count: number
          source_count: number
          started_at: string
        }
        Update: {
          created_at?: string
          failed_count?: number
          finished_at?: string
          healthy?: boolean
          ingest_run_id?: string
          issue_count?: number
          ok_count?: number
          source_count?: number
          started_at?: string
        }
        Relationships: []
      }
      trusted_forecast_ingest_source_results: {
        Row: {
          attempts: number | null
          authority_issue_count: number
          created_at: string
          degraded_failure_code: string | null
          degraded_item_count: number
          failure_code: string | null
          finished_at: string
          http_status: number | null
          ingest_run_id: string
          issue_count: number
          parser_key: string
          parser_version: string
          provider_lineage: string
          redirect_hops: number | null
          source_key: string
          source_result_id: string
          started_at: string
          status: string
        }
        Insert: {
          attempts?: number | null
          authority_issue_count?: number
          created_at?: string
          degraded_failure_code?: string | null
          degraded_item_count?: number
          failure_code?: string | null
          finished_at: string
          http_status?: number | null
          ingest_run_id: string
          issue_count?: number
          parser_key: string
          parser_version: string
          provider_lineage: string
          redirect_hops?: number | null
          source_key: string
          source_result_id?: string
          started_at: string
          status: string
        }
        Update: {
          attempts?: number | null
          authority_issue_count?: number
          created_at?: string
          degraded_failure_code?: string | null
          degraded_item_count?: number
          failure_code?: string | null
          finished_at?: string
          http_status?: number | null
          ingest_run_id?: string
          issue_count?: number
          parser_key?: string
          parser_version?: string
          provider_lineage?: string
          redirect_hops?: number | null
          source_key?: string
          source_result_id?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      trusted_forecast_issues: {
        Row: {
          authority_eligible: boolean
          beach_id: string | null
          created_at: string
          day_part: string
          direction_deg: number | null
          evidence_class: string
          exposure: string
          fetched_at: string
          ingest_run_id: string | null
          issue_id: string
          issue_identity_key: string
          issued_at: string
          max_face_ft: number | null
          measurement_basis: string
          min_face_ft: number | null
          parser_version: string
          period_seconds: number | null
          provider_lineage: string
          region_key: string | null
          revision_hash: string
          scope_type: string
          source_hash: string
          source_key: string
          supersedes_issue_id: string | null
          valid_end_at: string
          valid_local_date: string
          valid_start_at: string
          valid_timezone: string
          validity_basis: string
        }
        Insert: {
          authority_eligible: boolean
          beach_id?: string | null
          created_at?: string
          day_part: string
          direction_deg?: number | null
          evidence_class: string
          exposure: string
          fetched_at: string
          ingest_run_id?: string | null
          issue_id?: string
          issue_identity_key: string
          issued_at: string
          max_face_ft?: number | null
          measurement_basis: string
          min_face_ft?: number | null
          parser_version: string
          period_seconds?: number | null
          provider_lineage: string
          region_key?: string | null
          revision_hash: string
          scope_type: string
          source_hash: string
          source_key: string
          supersedes_issue_id?: string | null
          valid_end_at: string
          valid_local_date: string
          valid_start_at: string
          valid_timezone: string
          validity_basis: string
        }
        Update: {
          authority_eligible?: boolean
          beach_id?: string | null
          created_at?: string
          day_part?: string
          direction_deg?: number | null
          evidence_class?: string
          exposure?: string
          fetched_at?: string
          ingest_run_id?: string | null
          issue_id?: string
          issue_identity_key?: string
          issued_at?: string
          max_face_ft?: number | null
          measurement_basis?: string
          min_face_ft?: number | null
          parser_version?: string
          period_seconds?: number | null
          provider_lineage?: string
          region_key?: string | null
          revision_hash?: string
          scope_type?: string
          source_hash?: string
          source_key?: string
          supersedes_issue_id?: string | null
          valid_end_at?: string
          valid_local_date?: string
          valid_start_at?: string
          valid_timezone?: string
          validity_basis?: string
        }
        Relationships: [
          {
            foreignKeyName: "trusted_forecast_issues_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trusted_forecast_issues_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "trusted_forecast_issues_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trusted_forecast_issues_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "trusted_forecast_issues_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "trusted_forecast_issues_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "trusted_forecast_issues_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "trusted_forecast_issues_supersedes_issue_id_fkey"
            columns: ["supersedes_issue_id"]
            isOneToOne: false
            referencedRelation: "trusted_forecast_issues"
            referencedColumns: ["issue_id"]
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
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
          },
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
          {
            foreignKeyName: "user_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
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
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
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
          {
            foreignKeyName: "user_beach_affinity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_beach_exclusions: {
        Row: {
          beach_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          beach_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          beach_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_beach_exclusions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_beach_exclusions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "user_beach_exclusions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_beach_exclusions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "user_beach_exclusions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "user_beach_exclusions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "user_beach_exclusions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "user_beach_exclusions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "user_beach_exclusions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_beach_exclusions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_beach_exclusions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_devices: {
        Row: {
          app_version: string | null
          build_number: string | null
          created_at: string
          device_token: string
          expo_channel: string | null
          expo_is_embedded_launch: boolean | null
          expo_is_emergency_launch: boolean | null
          expo_runtime_version: string | null
          expo_sdk: string | null
          expo_update_id: string | null
          id: string
          installation_id: string | null
          os_version: string | null
          platform: string
          retired_at: string | null
          retired_reason: string | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          build_number?: string | null
          created_at?: string
          device_token: string
          expo_channel?: string | null
          expo_is_embedded_launch?: boolean | null
          expo_is_emergency_launch?: boolean | null
          expo_runtime_version?: string | null
          expo_sdk?: string | null
          expo_update_id?: string | null
          id?: string
          installation_id?: string | null
          os_version?: string | null
          platform: string
          retired_at?: string | null
          retired_reason?: string | null
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          build_number?: string | null
          created_at?: string
          device_token?: string
          expo_channel?: string | null
          expo_is_embedded_launch?: boolean | null
          expo_is_emergency_launch?: boolean | null
          expo_runtime_version?: string | null
          expo_sdk?: string | null
          expo_update_id?: string | null
          id?: string
          installation_id?: string | null
          os_version?: string | null
          platform?: string
          retired_at?: string | null
          retired_reason?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
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
          {
            foreignKeyName: "user_email_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_entitlements: {
        Row: {
          billing_issue: boolean
          created_at: string
          expires_at: string | null
          is_pro: boolean
          is_trialing: boolean
          lapsed_at: string | null
          previous_product_id: string | null
          product_id: string | null
          rc_raw: Json | null
          trial_ends_at: string | null
          updated_at: string
          user_id: string
          will_renew: boolean
        }
        Insert: {
          billing_issue?: boolean
          created_at?: string
          expires_at?: string | null
          is_pro?: boolean
          is_trialing?: boolean
          lapsed_at?: string | null
          previous_product_id?: string | null
          product_id?: string | null
          rc_raw?: Json | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
          will_renew?: boolean
        }
        Update: {
          billing_issue?: boolean
          created_at?: string
          expires_at?: string | null
          is_pro?: boolean
          is_trialing?: boolean
          lapsed_at?: string | null
          previous_product_id?: string | null
          product_id?: string | null
          rc_raw?: Json | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
          will_renew?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "user_entitlements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_entitlements_failed_webhooks: {
        Row: {
          error_message: string | null
          event_type: string | null
          id: string
          last_retried_at: string | null
          payload: Json
          received_at: string
          retry_count: number
          user_id: string | null
        }
        Insert: {
          error_message?: string | null
          event_type?: string | null
          id?: string
          last_retried_at?: string | null
          payload: Json
          received_at?: string
          retry_count?: number
          user_id?: string | null
        }
        Update: {
          error_message?: string | null
          event_type?: string | null
          id?: string
          last_retried_at?: string | null
          payload?: Json
          received_at?: string
          retry_count?: number
          user_id?: string | null
        }
        Relationships: []
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
          {
            foreignKeyName: "user_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
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
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
          },
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
            foreignKeyName: "user_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
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
          {
            foreignKeyName: "user_follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
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
        Relationships: [
          {
            foreignKeyName: "user_implicit_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_learning_signals: {
        Row: {
          beach_id: string | null
          first_fired_at: string
          id: string
          signal_key: string
          user_id: string
        }
        Insert: {
          beach_id?: string | null
          first_fired_at?: string
          id?: string
          signal_key: string
          user_id: string
        }
        Update: {
          beach_id?: string | null
          first_fired_at?: string
          id?: string
          signal_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_learning_signals_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_learning_signals_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "user_learning_signals_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_learning_signals_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "user_learning_signals_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "user_learning_signals_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "user_learning_signals_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "user_learning_signals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_location_snapshots: {
        Row: {
          captured_at: string
          lat: number
          lon: number
          source: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          captured_at: string
          lat: number
          lon: number
          source: string
          timezone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          captured_at?: string
          lat?: number
          lon?: number
          source?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_location_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "user_location_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_location_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_location_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_surf_preferences: {
        Row: {
          avoidance_by_beach: Json
          confidence: number
          created_at: string | null
          eligible_session_count: number
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
          avoidance_by_beach?: Json
          confidence?: number
          created_at?: string | null
          eligible_session_count?: number
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
          avoidance_by_beach?: Json
          confidence?: number
          created_at?: string | null
          eligible_session_count?: number
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
        Relationships: [
          {
            foreignKeyName: "user_surf_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_surf_preferences_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "user_surf_preferences_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_surf_preferences_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_surf_preferences_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
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
        Relationships: [
          {
            foreignKeyName: "user_xp_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      water_quality_held_beaches: {
        Row: {
          beach_id: string
          created_at: string
          reason: string | null
        }
        Insert: {
          beach_id: string
          created_at?: string
          reason?: string | null
        }
        Update: {
          beach_id?: string
          created_at?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "water_quality_held_beaches_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "water_quality_held_beaches_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "water_quality_held_beaches_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "water_quality_held_beaches_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "water_quality_held_beaches_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "water_quality_held_beaches_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "water_quality_held_beaches_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: true
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
        ]
      }
      weekend_scout_snapshots: {
        Row: {
          contract_version: string
          created_at: string
          generated_at: string
          id: string
          lead_beach_id: string
          lead_beach_name: string
          lead_window_local: string
          location_captured_at: string
          location_timezone: string
          max_drive_minutes: number
          qualifying_count: number
          rankings: Json
          scorer_version: string
          user_id: string
          weekend_end: string
          weekend_start: string
        }
        Insert: {
          contract_version: string
          created_at?: string
          generated_at: string
          id?: string
          lead_beach_id: string
          lead_beach_name: string
          lead_window_local: string
          location_captured_at: string
          location_timezone: string
          max_drive_minutes: number
          qualifying_count: number
          rankings: Json
          scorer_version: string
          user_id: string
          weekend_end: string
          weekend_start: string
        }
        Update: {
          contract_version?: string
          created_at?: string
          generated_at?: string
          id?: string
          lead_beach_id?: string
          lead_beach_name?: string
          lead_window_local?: string
          location_captured_at?: string
          location_timezone?: string
          max_drive_minutes?: number
          qualifying_count?: number
          rankings?: Json
          scorer_version?: string
          user_id?: string
          weekend_end?: string
          weekend_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekend_scout_snapshots_lead_beach_id_fkey"
            columns: ["lead_beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekend_scout_snapshots_lead_beach_id_fkey"
            columns: ["lead_beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "weekend_scout_snapshots_lead_beach_id_fkey"
            columns: ["lead_beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekend_scout_snapshots_lead_beach_id_fkey"
            columns: ["lead_beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "weekend_scout_snapshots_lead_beach_id_fkey"
            columns: ["lead_beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "weekend_scout_snapshots_lead_beach_id_fkey"
            columns: ["lead_beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "weekend_scout_snapshots_lead_beach_id_fkey"
            columns: ["lead_beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "weekend_scout_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "weekend_scout_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekend_scout_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekend_scout_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
          },
        ]
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
          idempotency_key: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          user_id: string
          xp_amount: number
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          idempotency_key?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          user_id: string
          xp_amount: number
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          idempotency_key?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          user_id?: string
          xp_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "xp_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      zz_luna_test: {
        Row: {
          i: number | null
        }
        Insert: {
          i?: number | null
        }
        Update: {
          i?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      auth_apple_orphan_users: {
        Row: {
          apple_sub: string | null
          created_at: string | null
          email: string | null
          iss: string | null
          last_sign_in_at: string | null
          primary_provider: string | null
          providers_list: Json | null
          user_id: string | null
        }
        Insert: {
          apple_sub?: never
          created_at?: string | null
          email?: string | null
          iss?: never
          last_sign_in_at?: string | null
          primary_provider?: never
          providers_list?: never
          user_id?: string | null
        }
        Update: {
          apple_sub?: never
          created_at?: string | null
          email?: string | null
          iss?: never
          last_sign_in_at?: string | null
          primary_provider?: never
          providers_list?: never
          user_id?: string | null
        }
        Relationships: []
      }
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
      blocked_user_ids: {
        Row: {
          blocked_id: string | null
        }
        Insert: {
          blocked_id?: string | null
        }
        Update: {
          blocked_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_home_beach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
          },
        ]
      }
      growth_app_handoff_v1: {
        Row: {
          cohort_anchor: string | null
          d1_returned: boolean | null
          d7_returned: boolean | null
          eligible_24h: boolean | null
          eligible_7d: boolean | null
          eligible_d1: boolean | null
          eligible_d7: boolean | null
          entrypoint: string | null
          evidence_level: string | null
          first_email_action_at: string | null
          first_handoff_view_at: string | null
          first_native_activation_at: string | null
          first_native_open_at: string | null
          first_persisted_session_at: string | null
          first_phone_link_open_at: string | null
          first_qr_action_at: string | null
          first_store_redirect_at: string | null
          handoff_channel: string | null
          handoff_id: string | null
          linked_profile_id: string | null
          persisted_session_within_7d: boolean | null
          placement: string | null
          source_capture_status: string | null
          source_group: string | null
          surface: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Relationships: []
      }
      growth_native_install_activation_v1: {
        Row: {
          app_build: string | null
          cohort_anchor: string | null
          d1_returned: boolean | null
          d7_returned: boolean | null
          eligible_24h: boolean | null
          eligible_7d: boolean | null
          eligible_d1: boolean | null
          eligible_d7: boolean | null
          entrypoint: string | null
          evidence_level: string | null
          first_auth_at: string | null
          first_high_intent_native_at: string | null
          first_onboarding_completed_at: string | null
          first_persisted_session_at: string | null
          first_session_log_start_at: string | null
          handoff_id: string | null
          linked_profile_id: string | null
          native_install_id: string | null
          persisted_session_within_7d: boolean | null
          platform: string | null
          referrer_domain: string | null
          source_capture_status: string | null
          source_group: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_events_user_id_fkey"
            columns: ["linked_profile_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      growth_web_signup_activation_v1: {
        Row: {
          cohort_anchor: string | null
          cohort_type: string | null
          d1_returned: boolean | null
          d7_returned: boolean | null
          eligible_24h: boolean | null
          eligible_7d: boolean | null
          eligible_d1: boolean | null
          eligible_d7: boolean | null
          entrypoint: string | null
          evidence_level: string | null
          first_app_handoff_intent_at: string | null
          first_linked_native_open_at: string | null
          first_persisted_session_at: string | null
          first_web_product_activation_at: string | null
          persisted_session_within_7d: boolean | null
          profile_id: string | null
          referrer_domain: string | null
          source_capture_status: string | null
          source_group: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
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
      mv_nowcast_anchors: {
        Row: {
          beach_id: string | null
          observed_at: string | null
          station_id: string | null
          wave_direction_deg: number | null
          wave_height_m: number | null
          wave_period_s: number | null
        }
        Relationships: []
      }
      nsm_activation: {
        Row: {
          activation_rate: number | null
          day: string | null
          first_session_users: number | null
          new_users: number | null
          source: string | null
        }
        Relationships: []
      }
      nsm_daily_logged_sessions: {
        Row: {
          day: string | null
          logged_sessions: number | null
          source: string | null
        }
        Relationships: []
      }
      nsm_repeat_3plus_21d: {
        Row: {
          day: string | null
          repeat_users_3plus_21d: number | null
          source: string | null
        }
        Relationships: []
      }
      nsm_time_to_first_session: {
        Row: {
          activated_users: number | null
          median_hours_to_first_session: number | null
          p75_hours_to_first_session: number | null
          signup_day: string | null
          source: string | null
        }
        Relationships: []
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
      public_session_feed_eligibility: {
        Row: {
          arrival_time: string | null
          beach_id: string | null
          created_at: string | null
          has_context: boolean | null
          has_media: boolean | null
          informative: boolean | null
          session_id: string | null
          strong: boolean | null
          thin: boolean | null
          user_id: string | null
          warning: boolean | null
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
            foreignKeyName: "sessions_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "growth_web_signup_activation_v1"
            referencedColumns: ["profile_id"]
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
          {
            foreignKeyName: "sessions_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "session_activation_report"
            referencedColumns: ["user_id"]
          },
        ]
      }
      recommendation_feedback_summary: {
        Row: {
          beach_id: string | null
          impression_at: string | null
          rank: number | null
          rating: number | null
          recommendation_call_accuracy: string | null
          recommendation_id: string | null
          score: number | null
          session_created_at: string | null
          session_id: string | null
          surface: string | null
          tide_status_correct: boolean | null
          user_id: string | null
          wave_height_correct: boolean | null
          window_end: string | null
          window_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_impressions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_impressions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "recommendation_impressions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_impressions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "recommendation_impressions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "recommendation_impressions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "recommendation_impressions_beach_id_fkey"
            columns: ["beach_id"]
            isOneToOne: false
            referencedRelation: "v_tide_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "recommendation_impressions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_apple_orphan_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      roadmap_items_with_vote_count: {
        Row: {
          category: Database["public"]["Enums"]["roadmap_category"] | null
          created_at: string | null
          description: string | null
          eta_label: string | null
          founder_reply: string | null
          id: string | null
          shipped_at: string | null
          status: Database["public"]["Enums"]["roadmap_status"] | null
          title: string | null
          updated_at: string | null
          vote_count: number | null
        }
        Relationships: []
      }
      session_activation_report: {
        Row: {
          completed_session_count: number | null
          days_to_first_session: number | null
          first_qualified_public_session_at: string | null
          first_session_at: string | null
          first_session_beach_id: string | null
          first_session_id: string | null
          first_thin_public_session_at: string | null
          first_warning_session_at: string | null
          has_second_session_within_14d: boolean | null
          public_session_count: number | null
          qualified_public_session_count: number | null
          second_session_within_14d_at: string | null
          second_session_within_14d_id: string | null
          signup_at: string | null
          thin_public_session_count: number | null
          user_id: string | null
          warning_session_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_beach_id_fkey"
            columns: ["first_session_beach_id"]
            isOneToOne: false
            referencedRelation: "beach_location_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_beach_id_fkey"
            columns: ["first_session_beach_id"]
            isOneToOne: false
            referencedRelation: "beach_ml_performance_baseline"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "sessions_beach_id_fkey"
            columns: ["first_session_beach_id"]
            isOneToOne: false
            referencedRelation: "beaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_beach_id_fkey"
            columns: ["first_session_beach_id"]
            isOneToOne: false
            referencedRelation: "v_enhanced_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "sessions_beach_id_fkey"
            columns: ["first_session_beach_id"]
            isOneToOne: false
            referencedRelation: "v_marine_forecast_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "sessions_beach_id_fkey"
            columns: ["first_session_beach_id"]
            isOneToOne: false
            referencedRelation: "v_sun_times_latest"
            referencedColumns: ["beach_id"]
          },
          {
            foreignKeyName: "sessions_beach_id_fkey"
            columns: ["first_session_beach_id"]
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
        Relationships: []
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
      accept_invite_for_user: {
        Args: { invitee: string; inviter: string }
        Returns: Json
      }
      acknowledge_trusted_forecast_alert: {
        Args: { p_acknowledgement: Json }
        Returns: {
          acknowledged: boolean
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_code: string
          alert_id: string
          beach_id: string
          build_key: string
          conflicting_issue_id: string | null
          created_at: string
          decision_id: string | null
          evidence: Json
          local_date: string
          primary_issue_id: string | null
          separation_ft: number
        }[]
        SetofOptions: {
          from: "*"
          to: "trusted_forecast_alerts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_community_spot_photos_v1: {
        Args: {
          p_before?: string
          p_limit?: number
          p_status?: string
          p_target_id?: string
          p_target_type?: string
        }
        Returns: Json
      }
      allocate_experiment_batch: {
        Args: {
          p_experiment_key: string
          p_index_at?: string
          p_user_ids: string[]
        }
        Returns: {
          arm: number
          assignment_version: string
          build: string | null
          created_at: string
          experiment_key: string
          index_at: string
          linked_at: string | null
          source: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "experiment_assignments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      append_regional_recommendation_hold_transition: {
        Args: { p_transition: Json }
        Returns: {
          action: string
          affected_cohorts: string[]
          authorizing_actor: string
          authorizing_operator_ref: string | null
          automatic_policy_version: string | null
          created_at: string
          effective_at: string
          event_reference: string | null
          expires_at: string
          hold_id: string
          idempotency_key: string
          payload_hash: string
          protected_alternative_beach_ids: string[]
          reason_code: string
          record_id: string
          region_keys: string[]
          request_id: string | null
          scope_beach_ids: string[]
          scope_exposure_classes: string[]
          status: string
          supersedes_record_id: string | null
          supporting_evidence_refs: Json
          transition: string
          trigger_type: string
          valid_from: string
          valid_until: string
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "regional_recommendation_holds"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      apply_android_tester_roster_snapshot: {
        Args: {
          p_actor_user_id: string
          p_claim_token: string
          p_direct_user_count: number
          p_failure_code?: string
          p_observations: Json
          p_observed_at: string
          p_snapshot_complete: boolean
        }
        Returns: Json
      }
      assess_apple_identity_recovery: {
        Args: {
          p_apple_sub: string
          p_apple_token_sha256: string
          p_canonical_user_id: string
          p_idempotency_key: string
        }
        Returns: Json
      }
      assign_experiment: {
        Args: {
          p_experiment_key: string
          p_index_at?: string
          p_user_id: string
        }
        Returns: {
          arm: number
          assignment_version: string
          build: string | null
          created_at: string
          experiment_key: string
          index_at: string
          linked_at: string | null
          source: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "experiment_assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      backfill_android_waitlist_entries: { Args: never; Returns: Json }
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
      bulk_update_hrrr_wind: { Args: { payload: Json }; Returns: number }
      can_view_surf_drop: {
        Args: { p_drop_id: string; p_viewer: string }
        Returns: boolean
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
      claim_android_tester_roster_sync: {
        Args: { p_actor_user_id: string; p_observed_at: string }
        Returns: string
      }
      claim_daily_forecast_notification_slot: {
        Args: {
          p_beach_id: string
          p_local_forecast_date: string
          p_notification_type: string
          p_user_id: string
        }
        Returns: boolean
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
      claim_notification_delivery_targets: {
        Args: {
          p_claim_id: string
          p_event_id: string
          p_installation_ids: string[]
        }
        Returns: {
          claim_id: string | null
          claim_version: number
          claimed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          installation_id: string
          notification_event_id: string
          provider_response: Json | null
          status: string
          token_fingerprint: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notification_delivery_targets"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_notification_events: {
        Args: {
          p_batch_size: number
          p_claim_token: string
          p_lease_seconds: number
        }
        Returns: {
          actor_user_id: string | null
          attempt_count: number
          cancel_reason: string | null
          claim_token: string | null
          claimed_at: string | null
          created_at: string
          dedupe_key: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          last_attempt_at: string | null
          last_error: string | null
          next_attempt_at: string | null
          payload: Json
          processed_at: string | null
          recipient_user_id: string
          skip_reason: string | null
          status: string
          type: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notification_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_stuck_community_spot_photo_uploads_v1: {
        Args: { p_limit?: number; p_now?: string }
        Returns: {
          photo_id: string
          storage_path: string
        }[]
      }
      claim_surf_alert_slot: {
        Args: {
          p_alert_date: string
          p_beach_id: string
          p_event_id: string
          p_priority: number
          p_recipient_user_id: string
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
      cleanup_orphan_smoke_profiles: { Args: never; Returns: number }
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
      community_photo_wilson_lower_bound: {
        Args: { p_downvotes: number; p_upvotes: number }
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
      compute_session_tide_snapshot: {
        Args: { p_arrival_time: string; p_beach_id: string }
        Returns: {
          tide_data_source: string
          tide_height_ft: number
          tide_rate_ft_per_hr: number
          tide_status: string
        }[]
      }
      compute_user_match_score: {
        Args: {
          p_beach_id: string
          p_tide_height: string
          p_user_id: string
          p_wave_height: string
          p_wave_period: string
          p_wind_direction: string
          p_wind_speed: string
        }
        Returns: Json
      }
      compute_user_match_score_batch: {
        Args: { p_beach_id: string; p_slots: Json; p_user_id: string }
        Returns: {
          forecast_at: string
          result: Json
          slot_idx: number
        }[]
      }
      compute_user_match_score_core: {
        Args: {
          p_beach_id: string
          p_tide_height: string
          p_user_id: string
          p_wave_height: string
          p_wave_period: string
          p_wind_direction: string
          p_wind_speed: string
        }
        Returns: Json
      }
      concat_text_array: { Args: { vals: string[] }; Returns: string }
      confirm_apple_identity_recovery: {
        Args: {
          p_canonical_user_id: string
          p_idempotency_key: string
          p_recovery_id: string
        }
        Returns: Json
      }
      count_auth_apple_orphan_users: { Args: never; Returns: number }
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
      create_custom_spot_guarded: {
        Args: {
          p_break_type?: string
          p_exposure_level?: string
          p_facing_direction_deg?: number
          p_lat: number
          p_lon: number
          p_name: string
          p_offshore_direction_deg?: number
          p_swell_window_max_deg?: number
          p_swell_window_min_deg?: number
          p_visibility?: string
        }
        Returns: {
          break_type: string
          created_at: string
          deleted_at: string
          exposure_level: string
          facing_direction_deg: number
          favorite_id: string
          favorite_rank: number
          fingerprint_confidence: string
          fingerprint_updated_at: string
          id: string
          lat: number
          lon: number
          name: string
          nearest_beach_distance_mi: number
          nearest_beach_id: string
          offshore_direction_deg: number
          swell_window_max_deg: number
          swell_window_min_deg: number
          updated_at: string
          user_id: string
          visibility: string
        }[]
      }
      delete_user_account: { Args: { p_user_id: string }; Returns: Json }
      detect_apple_orphan_after_sign_in: {
        Args: {
          p_apple_sub: string
          p_current_user_id: string
          p_idempotency_key: string
          p_native_install_id: string
        }
        Returns: Json
      }
      detect_apple_orphan_before_sign_in: {
        Args: {
          p_apple_sub: string
          p_full_name: string
          p_native_install_id: string
          p_token_issued_at: string
        }
        Returns: Json
      }
      ensure_user_xp: { Args: { p_user_id: string }; Returns: undefined }
      erase_regional_recommendation_hold_operator_v1: {
        Args: { p_user_id: string }
        Returns: Json
      }
      experiment_arm: {
        Args: { p_experiment_key: string; p_user_id: string }
        Returns: number
      }
      export_android_tester_roster_non_pii: {
        Args: never
        Returns: {
          eligibility_confidence: string
          eligibility_observed_at: string
          eligibility_source: string
          eligibility_status: string
          entry_id: string
          group_membership_status: string
          linked: boolean
          purge_after: string
          stage: string
          stage_confidence: string
          stage_observed_at: string
          stage_source: string
          stage_status: string
        }[]
      }
      fail_community_spot_photo_upload_v1: {
        Args: {
          p_photo_id: string
          p_reason_code: string
          p_uploader_id: string
        }
        Returns: boolean
      }
      finalize_anon_alert_capture: {
        Args: { p_email: string; p_user_id: string }
        Returns: {
          beach_id: string
          capture_id: string
          captured_at: string
          preset_type: string
          return_path: string
        }[]
      }
      finalize_community_spot_photo_v1: {
        Args: {
          p_height: number
          p_photo_id: string
          p_uploader_id: string
          p_width: number
        }
        Returns: boolean
      }
      finalize_notification_delivery_target: {
        Args: {
          p_claim_id: string
          p_claim_version: number
          p_error_message?: string
          p_provider_response?: Json
          p_status: string
          p_target_id: string
        }
        Returns: {
          claim_id: string | null
          claim_version: number
          claimed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          installation_id: string
          notification_event_id: string
          provider_response: Json | null
          status: string
          token_fingerprint: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "notification_delivery_targets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finalize_purged_community_spot_photos_v1: {
        Args: { p_photo_ids: string[] }
        Returns: number
      }
      finalize_stuck_community_spot_photo_uploads_v1: {
        Args: { p_photo_ids: string[] }
        Returns: number
      }
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
      follow_user_with_notification: {
        Args: {
          p_actor_id: string
          p_dedupe_key: string
          p_target_user_id: string
        }
        Returns: Json
      }
      generate_referral_code: { Args: never; Returns: string }
      generate_surf_drop_slug: { Args: never; Returns: string }
      get_admin_community_spot_photo_image_v1: {
        Args: { p_actor_id: string; p_audit_id: string; p_photo_id: string }
        Returns: {
          content_type: string
          storage_path: string
        }[]
      }
      get_all_beach_locations: {
        Args: never
        Returns: {
          beach_count: number
          city: string
          country: string
          state: string
        }[]
      }
      get_android_tester_roster_join_context: {
        Args: { p_idempotency_key_hash: string; p_user_id: string }
        Returns: {
          already_linked: boolean
          candidates: Json
          snapshot_complete: boolean
        }[]
      }
      get_android_tester_roster_summary: { Args: never; Returns: Json }
      get_android_tester_roster_sync_identities: {
        Args: never
        Returns: {
          auth_tag: string
          ciphertext: string
          eligibility_status: string
          entry_id: string
          iv: string
          key_version: number
          purge_after: string
          user_id: string
        }[]
      }
      get_android_waitlist_operator_projection: {
        Args: never
        Returns: {
          account_join_observed_at: string
          account_join_status: string
          authenticated_account_linked: boolean
          entry_id: string
          first_joined_at: string
          first_open_observed_at: string
          first_open_status: string
          group_membership_observed_at: string
          group_membership_status: string
          install_observed_at: string
          install_status: string
          last_joined_at: string
          play_opt_in_observed_at: string
          play_opt_in_status: string
          source_count: number
          source_kinds: string[]
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
          has_tide_data: boolean
          has_water_temp_data: boolean
          state: string
        }[]
      }
      get_city_editorial: {
        Args: {
          p_city: string
          p_country?: string
          p_intent?: string
          p_state?: string
        }
        Returns: {
          city_name: string
          city_slug: string
          country_slug: string
          created_at: string
          description: string[]
          editorial_reviewed_at: string | null
          editorial_sources: Json
          featured_intents: string[]
          id: string
          intent: string | null
          planning_checklist: string[]
          quick_links: Json
          region_label: string
          seo_indexable: boolean
          seo_intro: string | null
          seo_local_guidance: string | null
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
      get_community_photo_monitoring_v1: {
        Args: { p_since?: string }
        Returns: Json
      }
      get_community_spot_photo_image_v1: {
        Args: { p_photo_id: string; p_viewer_id?: string }
        Returns: {
          content_type: string
          storage_path: string
        }[]
      }
      get_conditions_alert_candidates: {
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
          experience_level: string
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
      get_forecast_accuracy_horizon_metrics: {
        Args: { p_end?: string; p_start?: string }
        Returns: {
          baseline: string
          bias_m: number
          horizon_bucket: string
          mae_m: number
          sample_count: number
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
      get_my_analytics_tracking_allowed: {
        Args: { p_expected_user_id: string }
        Returns: boolean
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
      get_nowcast_anchors: {
        Args: { max_age_hours?: number }
        Returns: {
          beach_id: string
          observed_at: string
          station_id: string
          wave_direction_deg: number
          wave_height_m: number
          wave_period_s: number
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
      get_popular_beaches: {
        Args: { p_limit?: number }
        Returns: {
          city: string
          id: string
          name: string
          slug: string
          state: string
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
      get_session_prompt_candidates: {
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
      get_session_wave_observation_analytics: { Args: never; Returns: Json }
      get_trusted_forecast_build_receipt: {
        Args: { p_build_key: string }
        Returns: {
          build_anchor_at: string
          build_key: string
          committed_at: string
          created_at: string
          durable_alert_count: number
          expected_alert_count: number
          expected_application_count: number
          expected_decision_count: number
          expected_snapshot_count: number
          inserted_alert_count: number
          inserted_application_count: number
          inserted_decision_count: number
          inserted_snapshot_count: number
          payload_sha256: string
          policy_version: string
          receipt_id: string
          reused_alert_count: number
          reused_application_count: number
          reused_decision_count: number
          reused_snapshot_count: number
          schema_version: string
        }[]
        SetofOptions: {
          from: "*"
          to: "trusted_forecast_build_receipts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_user_board_deck_stats: {
        Args: { p_user_id: string }
        Returns: {
          best_period_range: string
          best_wind_label: string
          board_id: string
          last_used_at: string
          learned_label: string
          positive_sessions_count: number
          sessions_count: number
        }[]
      }
      get_user_match_candidates: {
        Args: {
          p_device_lat?: number
          p_device_lon?: number
          p_exclude_beach_id?: string
          p_limit?: number
          p_radius_km?: number
          p_user_id: string
        }
        Returns: {
          beach: Json
          label: string
          score: number
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
      get_user_session_match_comparison: {
        Args: {
          p_beach_id: string
          p_tide_height: string
          p_user_id: string
          p_wave_height: string
          p_wave_period: string
          p_wind_direction: string
          p_wind_speed: string
        }
        Returns: Json
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
      get_user_streaks: { Args: { p_user_id: string }; Returns: Json }
      get_user_viral_coefficient: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_weekend_scout_candidates: {
        Args: {
          input_lat: number
          input_lon: number
          input_user_id: string
          limit_count?: number
          max_distance_meters: number
        }
        Returns: {
          distance_meters: number
          id: string
          total_count: number
        }[]
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
      has_user_block_between: {
        Args: { a: string; b: string }
        Returns: boolean
      }
      hold_community_spot_photo_v1: {
        Args: {
          p_actor_id: string
          p_idempotency_key: string
          p_photo_id: string
          p_reason: string
        }
        Returns: {
          hold_id: string
          placed_at: string
          reason: string
        }[]
      }
      increment_session_share_count: {
        Args: { session_id: string }
        Returns: undefined
      }
      increment_station_discovery_misses: {
        Args: { seen_ids: string[] }
        Returns: undefined
      }
      increment_user_xp: {
        Args: {
          p_action: string
          p_amount: number
          p_idempotency_key?: string
          p_related_entity_id?: string
          p_user_id: string
        }
        Returns: {
          awarded: number
          level: number
          xp_total: number
        }[]
      }
      is_admin_user: { Args: never; Returns: boolean }
      is_mutual_follow: { Args: { a: string; b: string }; Returns: boolean }
      like_session_with_notification: {
        Args: { p_actor_id: string; p_dedupe_key: string; p_session_id: string }
        Returns: Json
      }
      link_android_tester_roster_account: {
        Args: {
          p_entry_id: string
          p_idempotency_key_hash: string
          p_native_install_id: string
          p_user_id: string
        }
        Returns: {
          outcome: string
        }[]
      }
      link_anonymous_events: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: number
      }
      link_anonymous_events_v2: {
        Args: {
          p_session_id: string
          p_signup_context?: Json
          p_user_id: string
        }
        Returns: Json
      }
      link_experiment_eligibility: {
        Args: { p_build: string; p_source: string; p_user_id: string }
        Returns: {
          already_linked: boolean
          existing_build: string
          existing_source: string
          rows_linked: number
        }[]
      }
      list_orphan_community_photo_objects_v1: {
        Args: { p_limit?: number; p_now?: string }
        Returns: {
          storage_path: string
        }[]
      }
      list_owned_removed_community_spot_photos_v1: {
        Args: { p_uploader_id: string }
        Returns: {
          has_active_hold: boolean
          moderation_status: string
          photo_id: string
          recoverable_until: string
          target_id: string
          target_type: string
        }[]
      }
      moderate_community_spot_photo_v1: {
        Args: {
          p_action: string
          p_actor_id: string
          p_idempotency_key: string
          p_photo_id: string
          p_reason: string
        }
        Returns: string
      }
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
      parse_numeric_from_text: { Args: { input: string }; Returns: number }
      persist_trusted_forecast_build: {
        Args: { p_payload: Json }
        Returns: {
          build_anchor_at: string
          build_key: string
          committed_at: string
          created_at: string
          durable_alert_count: number
          expected_alert_count: number
          expected_application_count: number
          expected_decision_count: number
          expected_snapshot_count: number
          inserted_alert_count: number
          inserted_application_count: number
          inserted_decision_count: number
          inserted_snapshot_count: number
          payload_sha256: string
          policy_version: string
          receipt_id: string
          reused_alert_count: number
          reused_application_count: number
          reused_decision_count: number
          reused_snapshot_count: number
          schema_version: string
        }[]
        SetofOptions: {
          from: "*"
          to: "trusted_forecast_build_receipts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      pin_community_spot_photo_v1: {
        Args: {
          p_actor_id: string
          p_idempotency_key: string
          p_photo_id: string
          p_target_id: string
          p_target_type: string
        }
        Returns: boolean
      }
      preflight_community_spot_photo_upload_v1: {
        Args: { p_idempotency_key: string; p_uploader_id: string }
        Returns: boolean
      }
      preset_default_conditions: {
        Args: { p_beach_id: string; p_preset: string }
        Returns: Json
      }
      preset_default_name: {
        Args: { p_beach_id: string; p_preset: string }
        Returns: string
      }
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
      purge_android_tester_roster_identities: {
        Args: { p_actor_user_id: string; p_now?: string }
        Returns: number
      }
      purge_expired_regional_recommendation_holds_v1: {
        Args: never
        Returns: {
          chains_deleted: number
          rows_deleted: number
        }[]
      }
      purge_implicit_history: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      purge_removed_community_spot_photos_v1: {
        Args: { p_limit?: number; p_now?: string }
        Returns: {
          photo_id: string
          storage_path: string
        }[]
      }
      record_android_tester_roster_audit: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_entry_id: string
          p_evidence?: Json
          p_outcome: string
        }
        Returns: number
      }
      record_android_tester_roster_first_open: {
        Args: {
          p_idempotency_key_hash: string
          p_native_install_id: string
          p_user_id: string
        }
        Returns: {
          outcome: string
        }[]
      }
      record_android_tester_roster_install: {
        Args: {
          p_campaign: string
          p_created_on: string
          p_expires_on: string
          p_idempotency_key_hash: string
          p_native_install_id: string
          p_placement: string
          p_source: string
          p_surface: string
          p_user_id: string
        }
        Returns: {
          outcome: string
        }[]
      }
      record_android_tester_roster_stage: {
        Args: {
          p_actor_user_id: string
          p_confidence: string
          p_entry_id: string
          p_evidence?: Json
          p_observed_at: string
          p_source: string
          p_stage: string
          p_status: string
        }
        Returns: number
      }
      record_referral_attribution: {
        Args: {
          referee: string
          referral_code?: string
          referrer: string
          source: string
        }
        Returns: Json
      }
      recover_community_spot_photo_v1: {
        Args: {
          p_actor_id: string
          p_idempotency_key: string
          p_photo_id: string
        }
        Returns: boolean
      }
      recover_owned_community_spot_photo_v1: {
        Args: {
          p_idempotency_key: string
          p_photo_id: string
          p_uploader_id: string
        }
        Returns: {
          photo_id: string
          status: string
        }[]
      }
      redeem_install_attribution_token: {
        Args: { p_redemption_key_hash: string; p_token_hash: string }
        Returns: {
          campaign: string
          created_at: string
          expires_at: string
          placement: string
          source: string
          surface: string
        }[]
      }
      refresh_beach_ml_baseline: { Args: never; Returns: undefined }
      refresh_enhanced_forecasts_for_active_beaches: {
        Args: never
        Returns: Json
      }
      refresh_mv_beach_amenities: { Args: never; Returns: undefined }
      refresh_observable_beaches: { Args: never; Returns: undefined }
      regional_recommendation_hold_canonical_payload: {
        Args: {
          p_row: Database["public"]["Tables"]["regional_recommendation_holds"]["Row"]
        }
        Returns: Json
      }
      regional_recommendation_hold_refs_are_safe: {
        Args: { p_refs: Json }
        Returns: boolean
      }
      regional_recommendation_hold_region_keys_are_safe: {
        Args: { p_region_keys: string[] }
        Returns: boolean
      }
      register_device_installation: {
        Args: {
          p_device_token: string
          p_installation_id: string
          p_metadata?: Json
          p_platform: string
          p_user_id: string
        }
        Returns: {
          app_version: string | null
          build_number: string | null
          created_at: string
          device_token: string
          expo_channel: string | null
          expo_is_embedded_launch: boolean | null
          expo_is_emergency_launch: boolean | null
          expo_runtime_version: string | null
          expo_sdk: string | null
          expo_update_id: string | null
          id: string
          installation_id: string | null
          os_version: string | null
          platform: string
          retired_at: string | null
          retired_reason: string | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_devices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_legacy_device_token: {
        Args: {
          p_device_token: string
          p_metadata?: Json
          p_platform: string
          p_user_id: string
        }
        Returns: {
          app_version: string | null
          build_number: string | null
          created_at: string
          device_token: string
          expo_channel: string | null
          expo_is_embedded_launch: boolean | null
          expo_is_emergency_launch: boolean | null
          expo_runtime_version: string | null
          expo_sdk: string | null
          expo_update_id: string | null
          id: string
          installation_id: string | null
          os_version: string | null
          platform: string
          retired_at: string | null
          retired_reason: string | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_devices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      release_android_tester_roster_sync_claim: {
        Args: { p_claim_token: string }
        Returns: boolean
      }
      release_community_spot_photo_hold_v1: {
        Args: {
          p_actor_id: string
          p_idempotency_key: string
          p_photo_id: string
        }
        Returns: boolean
      }
      release_community_spot_photo_purge_v1: {
        Args: { p_photo_ids: string[] }
        Returns: number
      }
      release_stuck_community_spot_photo_uploads_v1: {
        Args: { p_photo_ids: string[] }
        Returns: number
      }
      remove_community_spot_photo_v1: {
        Args: {
          p_idempotency_key: string
          p_photo_id: string
          p_uploader_id: string
        }
        Returns: {
          photo_id: string
          recoverable_until: string
          status: string
        }[]
      }
      repair_strict_session_snapshots: {
        Args: { p_apply?: boolean; p_limit?: number }
        Returns: {
          beach_id: string
          delta_minutes: number
          forecast_at: string
          repaired: boolean
          session_id: string
          user_id: string
        }[]
      }
      report_community_spot_photo_v1: {
        Args: {
          p_idempotency_key: string
          p_photo_id: string
          p_reason: string
          p_reporter_id: string
        }
        Returns: {
          photo_id: string
          report_count: number
          status: string
        }[]
      }
      reserve_community_spot_photo_v1: {
        Args: {
          p_idempotency_key: string
          p_photo_id: string
          p_rights_confirmed: boolean
          p_storage_path: string
          p_target_id: string
          p_target_type: string
          p_terms_version: string
          p_uploader_id: string
          p_visibility: string
        }
        Returns: {
          photo_id: string
          processing_status: string
          replay: boolean
          storage_path: string
        }[]
      }
      resolve_active_regional_recommendation_holds: {
        Args: {
          p_as_of: string
          p_beach_ids: string[]
          p_window_end: string
          p_window_start: string
        }
        Returns: {
          action: string
          affected_cohorts: string[]
          authorizing_actor: string
          authorizing_operator_ref: string | null
          automatic_policy_version: string | null
          created_at: string
          effective_at: string
          event_reference: string | null
          expires_at: string
          hold_id: string
          idempotency_key: string
          payload_hash: string
          protected_alternative_beach_ids: string[]
          reason_code: string
          record_id: string
          region_keys: string[]
          request_id: string | null
          scope_beach_ids: string[]
          scope_exposure_classes: string[]
          status: string
          supersedes_record_id: string | null
          supporting_evidence_refs: Json
          transition: string
          trigger_type: string
          valid_from: string
          valid_until: string
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "regional_recommendation_holds"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      resolve_android_waitlist_entry: {
        Args: {
          p_normalized_email_sha256: string
          p_observed_at: string
          p_placement: string
          p_roster_entry_id: string
          p_source: string
          p_source_id: string
          p_source_kind: string
          p_surface: string
          p_user_id: string
        }
        Returns: string
      }
      resolve_community_spot_photo_batch_v1: {
        Args: {
          p_limit_per_target?: number
          p_targets: Json
          p_viewer_id?: string
        }
        Returns: {
          created_at: string
          display_name: string
          downvotes: number
          height: number
          is_pinned: boolean
          photo_id: string
          target_id: string
          target_type: string
          uploader_id: string
          upvotes: number
          viewer_vote: string
          visibility: string
          width: number
          wilson_score: number
        }[]
      }
      resolve_community_spot_photo_by_id_v1: {
        Args: { p_photo_id: string; p_viewer_id: string }
        Returns: {
          created_at: string
          display_name: string
          downvotes: number
          height: number
          is_pinned: boolean
          photo_id: string
          target_id: string
          target_type: string
          uploader_id: string
          upvotes: number
          viewer_vote: string
          visibility: string
          width: number
          wilson_score: number
        }[]
      }
      resolve_community_spot_photos_v1: {
        Args: {
          p_limit?: number
          p_target_id: string
          p_target_type: string
          p_viewer_id?: string
        }
        Returns: {
          created_at: string
          display_name: string
          downvotes: number
          height: number
          is_pinned: boolean
          photo_id: string
          target_id: string
          target_type: string
          uploader_id: string
          upvotes: number
          viewer_vote: string
          visibility: string
          width: number
          wilson_score: number
        }[]
      }
      restore_entity: {
        Args: { entity_id: string; table_name: string }
        Returns: boolean
      }
      restrict_community_photo_contributor_v1: {
        Args: {
          p_actor_id: string
          p_contributor_id: string
          p_idempotency_key: string
          p_reason_code: string
          p_restricted_until: string
        }
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
      strict_session_snapshot_repair_candidates: {
        Args: { p_limit?: number }
        Returns: {
          arrival_time: string
          beach_id: string
          custom_spot_id: string
          delta_minutes: number
          forecast_at: string
          nearest_beach_distance_mi: number
          session_id: string
          user_id: string
        }[]
      }
      swell_windows_overlap: {
        Args: { p_max1: number; p_max2: number; p_min1: number; p_min2: number }
        Returns: number
      }
      sync_session_wave_observation_candidate: {
        Args: {
          p_arrival_time: string
          p_beach_id: string
          p_session_id: string
          p_source_created_by?: string
          p_status: string
          p_user_id: string
          p_wave_height_ft: number
        }
        Returns: string
      }
      toggle_favorite_beach_guarded: {
        Args: { p_beach_id: string }
        Returns: string
      }
      toggle_favorite_spot_guarded: {
        Args: { p_beach_id?: string; p_custom_spot_id?: string }
        Returns: string
      }
      trigger_manual_maintenance: { Args: never; Returns: Json }
      trusted_forecast_canonical_alert: { Args: { p_row: Json }; Returns: Json }
      trusted_forecast_canonical_application: {
        Args: { p_row: Json }
        Returns: Json
      }
      trusted_forecast_canonical_build_payload: {
        Args: { p_payload: Json }
        Returns: Json
      }
      trusted_forecast_canonical_decision: {
        Args: { p_row: Json }
        Returns: Json
      }
      trusted_forecast_canonical_number: {
        Args: { p_value: Json }
        Returns: Json
      }
      trusted_forecast_canonical_snapshot: {
        Args: { p_row: Json }
        Returns: Json
      }
      trusted_forecast_canonical_timestamp: {
        Args: { p_value: Json }
        Returns: Json
      }
      trusted_forecast_snapshot_columns: { Args: never; Returns: string[] }
      try_insert_similarity_alert: {
        Args: {
          p_alert_date: string
          p_beach_id: string
          p_best_hour: string
          p_conditions_snapshot: Json
          p_rule_id: string
          p_send_at: string
          p_user_id: string
          p_window_end: string
          p_window_start: string
        }
        Returns: {
          alert_queue_id: string
          inserted: boolean
        }[]
      }
      try_insert_system_feed_post: {
        Args: {
          p_beach_daily_cap?: number
          p_beach_id: string
          p_beach_weekly_cap?: number
          p_created_at: string
          p_daily_cap?: number
          p_dedupe_hash: string
          p_description: string
          p_expires_at: string
          p_is_active: boolean
          p_latitude: number
          p_longitude: number
          p_surf_conditions: Json
          p_tag: string
          p_title: string
          p_user_id: string
        }
        Returns: {
          post_id: string
          status: string
        }[]
      }
      unaccent: { Args: { "": string }; Returns: string }
      unpin_community_spot_photo_v1: {
        Args: {
          p_actor_id: string
          p_idempotency_key: string
          p_photo_id: string
        }
        Returns: boolean
      }
      unrestrict_community_photo_contributor_v1: {
        Args: {
          p_actor_id: string
          p_contributor_id: string
          p_idempotency_key: string
        }
        Returns: boolean
      }
      update_beach_coordinates: {
        Args: { p_beach_id: string; p_latitude: number; p_longitude: number }
        Returns: undefined
      }
      update_custom_spot_fingerprint: {
        Args: {
          p_exposure_level?: string
          p_facing_direction_deg?: number
          p_offshore_direction_deg?: number
          p_spot_id: string
          p_swell_window_max_deg?: number
          p_swell_window_min_deg?: number
        }
        Returns: {
          break_type: string | null
          created_at: string
          deleted_at: string | null
          exposure_level: string | null
          facing_direction_deg: number | null
          fingerprint_confidence: string | null
          fingerprint_updated_at: string | null
          id: string
          lat: number
          lon: number
          name: string
          nearest_beach_distance_mi: number | null
          nearest_beach_id: string | null
          offshore_direction_deg: number | null
          swell_window_max_deg: number | null
          swell_window_min_deg: number | null
          updated_at: string
          user_id: string
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "custom_spots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_forecast_table_stats: { Args: never; Returns: undefined }
      update_open_meteo_wind_for_beach: {
        Args: { p_beach_id: string; p_points: Json }
        Returns: Json
      }
      update_user_storage_usage: {
        Args: {
          p_bytes_to_add: number
          p_images_to_add?: number
          p_user_id: string
        }
        Returns: undefined
      }
      vote_community_spot_photo_v1: {
        Args: {
          p_idempotency_key: string
          p_photo_id: string
          p_vote: string
          p_voter_id: string
        }
        Returns: {
          downvotes: number
          photo_id: string
          upvotes: number
          vote: string
          vote_score: number
        }[]
      }
    }
    Enums: {
      beach_persona:
        | "sheltered_reef"
        | "exposed_beach_break"
        | "canyon_amplified"
        | "point_break"
        | "jetty_harbor"
      content_report_reason:
        | "spam"
        | "harassment"
        | "hate_speech"
        | "sexual_content"
        | "violence"
        | "self_harm"
        | "misinformation"
        | "ip_violation"
        | "other"
      content_report_status: "pending" | "reviewing" | "actioned" | "dismissed"
      content_report_target: "user" | "session" | "comment" | "session_media"
      intel_post_tag:
        | "parking"
        | "hazard"
        | "crowd"
        | "conditions"
        | "access"
        | "other"
      intel_vote_type: "helpful" | "off" | "confirmed"
      roadmap_category:
        | "forecasts"
        | "logging"
        | "community"
        | "notifications"
        | "subscription"
        | "other"
      roadmap_status:
        | "under_consideration"
        | "in_progress"
        | "shipped"
        | "declined"
      roadmap_submission_decision:
        | "pending"
        | "approved"
        | "declined"
        | "merged_into"
      surf_drop_audience: "mutuals" | "friends" | "link" | "private"
    }
    CompositeTypes: {
      [_ in never]: never
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
      beach_persona: [
        "sheltered_reef",
        "exposed_beach_break",
        "canyon_amplified",
        "point_break",
        "jetty_harbor",
      ],
      content_report_reason: [
        "spam",
        "harassment",
        "hate_speech",
        "sexual_content",
        "violence",
        "self_harm",
        "misinformation",
        "ip_violation",
        "other",
      ],
      content_report_status: ["pending", "reviewing", "actioned", "dismissed"],
      content_report_target: ["user", "session", "comment", "session_media"],
      intel_post_tag: [
        "parking",
        "hazard",
        "crowd",
        "conditions",
        "access",
        "other",
      ],
      intel_vote_type: ["helpful", "off", "confirmed"],
      roadmap_category: [
        "forecasts",
        "logging",
        "community",
        "notifications",
        "subscription",
        "other",
      ],
      roadmap_status: [
        "under_consideration",
        "in_progress",
        "shipped",
        "declined",
      ],
      roadmap_submission_decision: [
        "pending",
        "approved",
        "declined",
        "merged_into",
      ],
      surf_drop_audience: ["mutuals", "friends", "link", "private"],
    },
  },
} as const
