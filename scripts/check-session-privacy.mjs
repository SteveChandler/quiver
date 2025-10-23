#!/usr/bin/env node

/**
 * Check Session Privacy Settings
 * Diagnoses why we're seeing 0 public sessions
 */

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSessionPrivacy() {
  console.log("🔍 Checking Session Privacy Settings\n");

  // Get all sessions with their privacy settings
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("id, user_id, beach_name, status, is_public, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("❌ Error:", error.message);
    return;
  }

  console.log(`Total sessions found: ${sessions?.length || 0}\n`);

  if (!sessions || sessions.length === 0) {
    console.log("⚠️  No sessions in database");
    return;
  }

  // Count by privacy
  const publicSessions = sessions.filter((s) => s.is_public === true);
  const privateSessions = sessions.filter((s) => s.is_public === false);
  const nullPrivacy = sessions.filter((s) => s.is_public === null);

  console.log("📊 Privacy Breakdown:");
  console.log(`   Public (is_public = true):  ${publicSessions.length}`);
  console.log(`   Private (is_public = false): ${privateSessions.length}`);
  console.log(`   Null (is_public = null):     ${nullPrivacy.length}`);
  console.log();

  // Count by status
  const planned = sessions.filter((s) => s.status === "planned");
  const completed = sessions.filter((s) => s.status === "completed");

  console.log("📝 Status Breakdown:");
  console.log(`   Planned:   ${planned.length}`);
  console.log(`   Completed: ${completed.length}`);
  console.log();

  // Show sample sessions
  console.log("📄 Sample Sessions (most recent):");
  sessions.slice(0, 10).forEach((session, i) => {
    console.log(
      `${i + 1}. ${session.beach_name || "No beach"} | ${
        session.status
      } | Public: ${session.is_public} | ${new Date(
        session.created_at
      ).toLocaleDateString()}`
    );
  });
  console.log();

  // Check if count queries work
  console.log("🔍 Testing Count Queries:");

  const { count: totalCount } = await supabase
    .from("sessions")
    .select("*", { count: "exact", head: true });
  console.log(`   Total count: ${totalCount}`);

  const { count: publicCount } = await supabase
    .from("sessions")
    .select("*", { count: "exact", head: true })
    .eq("is_public", true);
  console.log(`   Public count: ${publicCount}`);

  const { count: privateCount } = await supabase
    .from("sessions")
    .select("*", { count: "exact", head: true })
    .eq("is_public", false);
  console.log(`   Private count: ${privateCount}`);
  console.log();

  // Recommendations
  if (publicSessions.length === 0) {
    console.log("🚨 CRITICAL: No public sessions found!");
    console.log("   This means new users see an empty social feed.");
    console.log();
    console.log("💡 Possible causes:");
    console.log("   1. Sessions are being created with is_public = false");
    console.log("   2. Session form has a bug that sets is_public = false");
    console.log("   3. Users are manually setting sessions to private");
    console.log();
  } else if (publicSessions.length < sessions.length * 0.5) {
    console.log("⚠️  WARNING: Most sessions are private");
    console.log(
      `   Only ${((publicSessions.length / sessions.length) * 100).toFixed(
        0
      )}% of sessions are public`
    );
    console.log();
  }
}

checkSessionPrivacy().catch(console.error);
