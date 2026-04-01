import { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "./database.generated";

// Re-export for consumers that import from this file
export type { Database, Json };

/**
 * Service-role Supabase client. Uses the service_role key which bypasses
 * Row-Level Security (RLS). Only use in trusted server-side contexts such as
 * cron jobs, admin operations, or cross-user data access that cannot be
 * scoped through RLS policies.
 */
export type SupabaseServiceClient = SupabaseClient<Database>;

/**
 * Server-side Supabase client initialised with the requesting user's
 * cookie/session. All queries run through RLS policies, so the client only
 * sees data the authenticated user is allowed to access.
 */
export type SupabaseServerClient = SupabaseClient<Database>;

export const Constants = {
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
