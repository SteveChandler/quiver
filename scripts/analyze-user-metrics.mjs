#!/usr/bin/env node

/**
 * User Retention Analysis - Database Metrics
 *
 * This script analyzes the current state of the database to understand:
 * - How many sessions exist
 * - How many users are creating content
 * - How many users are engaging with social features
 * - What the social graph looks like
 *
 * Run: node scripts/analyze-user-metrics.mjs
 */

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing environment variables:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL:", !!supabaseUrl);
  console.error("   SUPABASE_SERVICE_ROLE_KEY:", !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function analyzeDatabase() {
  console.log("🔍 Analyzing Quiver Database Metrics\n");
  console.log("=".repeat(80));
  console.log("");

  // 1. Session Metrics
  console.log("📊 SESSION METRICS");
  console.log("-".repeat(80));

  const { data: totalSessions, error: sessionsError } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true });

  if (sessionsError) {
    console.error("❌ Error fetching sessions:", sessionsError.message);
  } else {
    console.log(`Total Sessions: ${totalSessions?.length || 0}`);
  }

  const { data: plannedSessions } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("status", "planned");

  console.log(`Planned Sessions: ${plannedSessions?.length || 0}`);

  const { data: completedSessions } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed");

  console.log(`Completed Sessions: ${completedSessions?.length || 0}`);

  const { data: publicSessions } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("is_public", true);

  console.log(
    `Public Sessions (available for feed): ${publicSessions?.length || 0}`
  );

  const { data: sessionsWithPhotos } = await supabase
    .from("session_media")
    .select("session_id", { count: "exact", head: true });

  console.log(`Sessions with Photos: ${sessionsWithPhotos?.length || 0}`);

  // 2. User Activity Metrics
  console.log("\n📈 USER ACTIVITY");
  console.log("-".repeat(80));

  const { data: usersWithSessions } = await supabase
    .from("sessions")
    .select("user_id");

  const uniqueSessionCreators = new Set(
    usersWithSessions?.map((s) => s.user_id)
  ).size;
  console.log(`Users who created sessions: ${uniqueSessionCreators}`);

  if (usersWithSessions && usersWithSessions.length > 0) {
    const sessionsPerUser = usersWithSessions.length / uniqueSessionCreators;
    console.log(
      `Average sessions per active user: ${sessionsPerUser.toFixed(1)}`
    );
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true });

  console.log(`Total Profiles: ${profiles?.length || 0}`);

  const { data: profilesWithOnboarding } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .not("onboarding_completed_at", "is", null);

  console.log(
    `Profiles completed onboarding: ${profilesWithOnboarding?.length || 0}`
  );

  // 3. Social Graph Metrics
  console.log("\n👥 SOCIAL GRAPH");
  console.log("-".repeat(80));

  const { data: follows } = await supabase
    .from("follows")
    .select("follower_id, following_id");

  console.log(`Total Follow Relationships: ${follows?.length || 0}`);

  const uniqueFollowers = new Set(follows?.map((f) => f.follower_id)).size;
  console.log(`Users who follow others: ${uniqueFollowers}`);

  const uniqueFollowees = new Set(follows?.map((f) => f.following_id)).size;
  console.log(`Users being followed: ${uniqueFollowees}`);

  if (follows && follows.length > 0 && uniqueFollowers > 0) {
    const avgFollowing = follows.length / uniqueFollowers;
    console.log(`Average follows per user: ${avgFollowing.toFixed(1)}`);
  }

  // 4. Engagement Metrics
  console.log("\n💬 ENGAGEMENT");
  console.log("-".repeat(80));

  const { data: likes } = await supabase
    .from("session_likes")
    .select("id", { count: "exact", head: true });

  console.log(`Total Session Likes: ${likes?.length || 0}`);

  const { data: comments } = await supabase
    .from("session_comments")
    .select("id", { count: "exact", head: true });

  console.log(`Total Session Comments: ${comments?.length || 0}`);

  const { data: activities } = await supabase
    .from("user_activities")
    .select("id", { count: "exact", head: true });

  console.log(`Total Activity Feed Items: ${activities?.length || 0}`);

  // 5. Content Metrics
  console.log("\n🏄 CONTENT");
  console.log("-".repeat(80));

  const { data: boards } = await supabase
    .from("boards")
    .select("id", { count: "exact", head: true });

  console.log(`Total Boards: ${boards?.length || 0}`);

  const { data: usersWithBoards } = await supabase
    .from("boards")
    .select("user_id");

  const uniqueBoardOwners = new Set(usersWithBoards?.map((b) => b.user_id))
    .size;
  console.log(`Users with boards: ${uniqueBoardOwners}`);

  const { data: reviews } = await supabase
    .from("beach_reviews")
    .select("id", { count: "exact", head: true });

  console.log(`Total Beach Reviews: ${reviews?.length || 0}`);

  const { data: intelPosts } = await supabase
    .from("intel_posts")
    .select("id", { count: "exact", head: true });

  console.log(`Total Intel Posts: ${intelPosts?.length || 0}`);

  // 6. Gamification Metrics
  console.log("\n🎮 GAMIFICATION");
  console.log("-".repeat(80));

  const { data: userXP } = await supabase
    .from("user_xp")
    .select("user_id, xp_total, level");

  console.log(`Users with XP records: ${userXP?.length || 0}`);

  if (userXP && userXP.length > 0) {
    const avgXP =
      userXP.reduce((sum, u) => sum + (u.xp_total || 0), 0) / userXP.length;
    const avgLevel =
      userXP.reduce((sum, u) => sum + (u.level || 0), 0) / userXP.length;
    console.log(`Average XP: ${avgXP.toFixed(0)}`);
    console.log(`Average Level: ${avgLevel.toFixed(1)}`);

    const maxXP = Math.max(...userXP.map((u) => u.xp_total || 0));
    const maxLevel = Math.max(...userXP.map((u) => u.level || 0));
    console.log(`Highest XP: ${maxXP}`);
    console.log(`Highest Level: ${maxLevel}`);
  }

  const { data: badges } = await supabase
    .from("user_badges")
    .select("id", { count: "exact", head: true });

  console.log(`Total Badges Earned: ${badges?.length || 0}`);

  // 7. Key Ratios
  console.log("\n📐 KEY RATIOS");
  console.log("-".repeat(80));

  const totalProfiles = profiles?.length || 0;

  if (totalProfiles > 0) {
    const sessionCreationRate = (
      (uniqueSessionCreators / totalProfiles) *
      100
    ).toFixed(1);
    console.log(
      `Session Creation Rate: ${sessionCreationRate}% (users who logged ≥1 session)`
    );

    const socialParticipationRate = (
      (uniqueFollowers / totalProfiles) *
      100
    ).toFixed(1);
    console.log(
      `Social Participation Rate: ${socialParticipationRate}% (users who followed someone)`
    );

    const boardCreationRate = (
      (uniqueBoardOwners / totalProfiles) *
      100
    ).toFixed(1);
    console.log(
      `Board Creation Rate: ${boardCreationRate}% (users who added a board)`
    );

    const onboardingRate = (
      ((profilesWithOnboarding?.length || 0) / totalProfiles) *
      100
    ).toFixed(1);
    console.log(`Onboarding Completion Rate: ${onboardingRate}%`);
  }

  // 8. Empty State Analysis
  console.log("\n🗂️  EMPTY STATE ANALYSIS");
  console.log("-".repeat(80));

  const publicSessionCount = publicSessions?.length || 0;
  const totalUserCount = totalProfiles;

  if (totalUserCount > 0) {
    const publicSessionsPerUser = (publicSessionCount / totalUserCount).toFixed(
      1
    );
    console.log(`Public sessions per user: ${publicSessionsPerUser}`);

    if (publicSessionCount < 10) {
      console.log(
        "⚠️  WARNING: Very few public sessions - new users see empty feed!"
      );
    } else if (publicSessionCount < 50) {
      console.log("⚠️  CAUTION: Limited public content - feed may feel sparse");
    } else {
      console.log("✅ Good amount of public content for social feed");
    }
  }

  // 9. Recommendations
  console.log("\n💡 RECOMMENDATIONS");
  console.log("-".repeat(80));

  if (uniqueSessionCreators < totalProfiles * 0.2) {
    console.log("🚨 CRITICAL: <20% of users have logged sessions");
    console.log(
      "   → Focus on activation: Get users to log their first session"
    );
  }

  if (uniqueFollowers < totalProfiles * 0.1) {
    console.log("🚨 CRITICAL: <10% of users follow others");
    console.log(
      "   → Social graph is weak - users don't see value in social features"
    );
  }

  if (publicSessionCount < 20) {
    console.log("🚨 CRITICAL: Very few public sessions");
    console.log("   → New users see empty feed - no social proof");
  }

  const totalEngagement = (likes?.length || 0) + (comments?.length || 0);
  if (totalEngagement < 10) {
    console.log("🚨 CRITICAL: Almost no social engagement");
    console.log("   → Users aren't interacting with content");
  }

  if ((profilesWithOnboarding?.length || 0) / totalProfiles < 0.5) {
    console.log("⚠️  WARNING: <50% complete onboarding");
    console.log("   → Onboarding may be too long or easy to skip");
  }

  console.log("\n" + "=".repeat(80));
  console.log("Analysis complete!\n");
}

analyzeDatabase().catch(console.error);
