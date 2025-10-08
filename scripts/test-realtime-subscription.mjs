#!/usr/bin/env node
/**
 * Test script to verify Supabase realtime is properly configured for intel tables
 * Run with: node scripts/test-realtime-subscription.mjs
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Missing Supabase credentials in .env file");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log("🔍 Testing Realtime Subscription for Intel Tables...\n");
console.log(`📡 Supabase URL: ${supabaseUrl}`);
console.log(`🔑 Using Anon Key: ${supabaseAnonKey.substring(0, 20)}...\n`);

// Test 1: Subscribe to intel_posts
console.log("1️⃣  Setting up subscription to intel_posts table...");
const intelPostsChannel = supabase
  .channel("test_intel_posts")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "intel_posts",
    },
    (payload) => {
      console.log("✅ Received intel_posts change:", {
        event: payload.eventType,
        table: payload.table,
        id: payload.new?.id || payload.old?.id,
      });
    }
  )
  .subscribe((status, error) => {
    if (status === "SUBSCRIBED") {
      console.log("✅ Successfully subscribed to intel_posts");
    } else if (status === "CHANNEL_ERROR") {
      console.error("❌ Channel error:", error);
    } else if (status === "TIMED_OUT") {
      console.error("❌ Subscription timed out");
    } else {
      console.log(`📊 Subscription status: ${status}`);
    }
  });

// Test 2: Subscribe to intel_post_confirmations
console.log("2️⃣  Setting up subscription to intel_post_confirmations table...");
const confirmationsChannel = supabase
  .channel("test_intel_confirmations")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "intel_post_confirmations",
    },
    (payload) => {
      console.log("✅ Received intel_post_confirmations change:", {
        event: payload.eventType,
        table: payload.table,
        id: payload.new?.id || payload.old?.id,
      });
    }
  )
  .subscribe((status, error) => {
    if (status === "SUBSCRIBED") {
      console.log("✅ Successfully subscribed to intel_post_confirmations");
    } else if (status === "CHANNEL_ERROR") {
      console.error("❌ Channel error:", error);
    } else if (status === "TIMED_OUT") {
      console.error("❌ Subscription timed out");
    } else {
      console.log(`📊 Subscription status: ${status}`);
    }
  });

console.log("\n⏳ Listening for changes for 10 seconds...");
console.log("💡 Try creating an intel post in another window to test!\n");

// Keep the script running for 10 seconds to listen for changes
setTimeout(() => {
  console.log("\n🏁 Test complete. Cleaning up...");
  supabase.removeChannel(intelPostsChannel);
  supabase.removeChannel(confirmationsChannel);
  process.exit(0);
}, 10000);
