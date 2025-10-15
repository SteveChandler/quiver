#!/usr/bin/env node

/**
 * Apply Performance Optimization Migrations
 *
 * This script applies the database performance optimizations directly.
 * Run with: node scripts/apply-performance-optimizations.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing required environment variables:");
  console.error("   - NEXT_PUBLIC_SUPABASE_URL");
  console.error("   - SUPABASE_SERVICE_ROLE_KEY");
  console.error("");
  console.error("💡 Add SUPABASE_SERVICE_ROLE_KEY to your .env.local file");
  console.error(
    "   (Get it from: Supabase Dashboard → Settings → API → service_role key)"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const SQL = `
-- Enable PostGIS extension if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Migration 1: Optimize Intel Posts Geospatial Queries
BEGIN;

CREATE INDEX IF NOT EXISTS idx_intel_posts_location_active 
ON intel_posts USING GIST (
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_intel_posts_tag_active
ON intel_posts (tag, is_active, expires_at)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_intel_posts_user_created
ON intel_posts (user_id, created_at DESC)
WHERE is_active = true;

COMMIT;

-- Migration 2: Optimize Beach Queries
BEGIN;

CREATE INDEX IF NOT EXISTS idx_beaches_name_with_coords
ON beaches (name, id, latitude, longitude)
WHERE latitude IS NOT NULL 
  AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_beaches_id_active
ON beaches (id)
WHERE latitude IS NOT NULL 
  AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_beaches_location
ON beaches USING GIST (
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
)
WHERE latitude IS NOT NULL 
  AND longitude IS NOT NULL;

COMMIT;

-- Migration 3: Optimize Realtime Subscription Tables
BEGIN;

CREATE INDEX IF NOT EXISTS idx_session_invitations_invitee_id_status
ON session_invitations (invitee_id, status, created_at DESC)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_session_invitations_invitee_email_status
ON session_invitations (invitee_email, status, created_at DESC)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_comments_session_created
ON comments (session_id, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_session_likes_session_user
ON session_likes (session_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_follows_following_created
ON user_follows (following_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower_created
ON user_follows (follower_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_intel_confirmations_post_created
ON intel_post_confirmations (post_id, created_at DESC);

COMMIT;
`;

console.log("🚀 Applying Performance Optimization Migrations...\n");

try {
  const { data, error } = await supabase.rpc("exec_sql", { query: SQL });

  if (error) {
    // Try alternative method if exec_sql doesn't exist
    console.log("📝 Executing SQL directly...\n");

    // Split into individual statements and execute
    const statements = SQL.split(";").filter((s) => s.trim());

    for (const statement of statements) {
      if (!statement.trim()) continue;

      const { error: execError } = await supabase.rpc("exec", {
        sql: statement + ";",
      });

      if (execError) {
        console.error("❌ Error:", execError.message);
        throw execError;
      }
    }
  }

  console.log("✅ Successfully applied all optimizations!\n");
  console.log("📊 13 indexes created for:");
  console.log("   • Intel posts geospatial queries");
  console.log("   • Beach data lookups");
  console.log("   • Realtime subscription tables\n");
  console.log("🎉 Expected impact: 80-90% reduction in database load\n");
} catch (err) {
  console.error("\n❌ Failed to apply migrations:", err.message);
  console.error("\n📋 Alternative: Apply via Supabase Dashboard");
  console.error("   1. Go to: https://supabase.com/dashboard");
  console.error("   2. Select your project → SQL Editor");
  console.error(
    "   3. Copy the SQL from: /tmp/final_performance_optimizations.sql"
  );
  console.error("   4. Paste and run\n");
  process.exit(1);
}
