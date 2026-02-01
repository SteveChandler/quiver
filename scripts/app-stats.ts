/**
 * App Stats Query Script
 * Queries production Supabase for application metrics
 *
 * Usage: npx tsx scripts/app-stats.ts
 * Requires: .env.production.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load production env (has the real Supabase URL, not local)
const prodEnvPath = path.join(process.cwd(), ".env.production.local");
if (fs.existsSync(prodEnvPath)) {
  dotenv.config({ path: prodEnvPath });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(JSON.stringify({
    error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.production.local"
  }));
  process.exit(1);
}

// Ensure we're hitting production, not local
if (supabaseUrl.includes("127.0.0.1") || supabaseUrl.includes("localhost")) {
  console.error(JSON.stringify({
    error: "Supabase URL points to local instance. Use .env.production.local for production stats."
  }));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    const [
      { count: totalUsers, error: e1 },
      { count: newUsers7d, error: e2 },
      { count: newUsers24h, error: e3 },
      { count: totalSessions, error: e4 },
      { count: sessions7d, error: e5 },
      { count: sessions24h, error: e6 },
      { data: sessionStats, error: e7 },
      { count: totalReviews, error: e8 },
      { count: reviews7d, error: e9 },
      { count: totalIntel, error: e10 },
      { count: intel7d, error: e11 },
      { count: totalBoards, error: e12 },
      { count: totalBeaches, error: e13 },
      { count: emails7d, error: e14 }
    ] = await Promise.all([
      // Users
      supabase.from("profiles").select("*", { count: "exact", head: true })
        .not("email", "ilike", "%test%").not("email", "like", "%@local.test"),
      supabase.from("profiles").select("*", { count: "exact", head: true })
        .not("email", "ilike", "%test%").not("email", "like", "%@local.test")
        .gte("created_at", sevenDaysAgo),
      supabase.from("profiles").select("*", { count: "exact", head: true })
        .not("email", "ilike", "%test%").not("email", "like", "%@local.test")
        .gte("created_at", oneDayAgo),
      // Sessions
      supabase.from("sessions").select("*", { count: "exact", head: true })
        .is("deleted_at", null),
      supabase.from("sessions").select("*", { count: "exact", head: true })
        .is("deleted_at", null).gte("created_at", sevenDaysAgo),
      supabase.from("sessions").select("*", { count: "exact", head: true })
        .is("deleted_at", null).gte("created_at", oneDayAgo),
      supabase.from("sessions").select("rating, duration_minutes, user_id")
        .is("deleted_at", null).gte("created_at", sevenDaysAgo),
      // Content
      supabase.from("beach_reviews").select("*", { count: "exact", head: true })
        .is("deleted_at", null),
      supabase.from("beach_reviews").select("*", { count: "exact", head: true })
        .is("deleted_at", null).gte("created_at", sevenDaysAgo),
      supabase.from("intel_posts").select("*", { count: "exact", head: true }),
      supabase.from("intel_posts").select("*", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo),
      supabase.from("boards").select("*", { count: "exact", head: true }),
      supabase.from("beaches").select("*", { count: "exact", head: true }),
      // Delivery
      supabase.from("email_send_log").select("*", { count: "exact", head: true })
        .gte("sent_at", sevenDaysAgo)
    ]);

    // Check for errors
    const errors = [e1, e2, e3, e4, e5, e6, e7, e8, e9, e10, e11, e12, e13, e14].filter(Boolean);
    if (errors.length > 0) {
      console.error(JSON.stringify({ error: "Query errors", details: errors }));
      process.exit(1);
    }

    // Compute session aggregates
    const activeSurfers7d = new Set(sessionStats?.map(s => s.user_id) || []).size;
    const ratings = sessionStats?.filter(s => s.rating !== null).map(s => s.rating) || [];
    const avgRating = ratings.length > 0
      ? (ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(2)
      : null;
    const durations = sessionStats?.filter(s => s.duration_minutes !== null).map(s => s.duration_minutes) || [];
    const avgDuration = durations.length > 0
      ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length)
      : null;

    console.log(JSON.stringify({
      users: { totalUsers, newUsers7d, newUsers24h },
      sessions: { totalSessions, sessions7d, sessions24h, activeSurfers7d, avgRating, avgDuration },
      content: { totalReviews, reviews7d, totalIntel, intel7d, totalBoards, totalBeaches },
      delivery: { emails7d }
    }));
  } catch (err) {
    console.error(JSON.stringify({ error: "Unexpected error", details: String(err) }));
    process.exit(1);
  }
}

main();
