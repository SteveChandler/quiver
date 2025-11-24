#!/usr/bin/env tsx
/**
 * Verify Personalized Forecast Caching
 *
 * Tests the cache-first strategy by:
 * 1. Calling the API and measuring response time
 * 2. Checking server logs for cache hit/miss indicators
 * 3. Repeating to verify subsequent calls use cache
 */

import { createSupabaseServiceRoleClient } from "../lib/supabase/server";

const TEST_USER_ID = "a8ef4d04-d07a-45ab-b6ba-7bcde1fb21ee";
const API_URL = "http://localhost:3000/api/home/personalized-forecast";

async function verifyCache() {
  console.log("🔍 Verifying Personalized Forecast Cache Implementation\n");

  // Test 1: First API call
  console.log("📊 Test 1: First API call (may generate or use existing cache)");
  const start1 = Date.now();

  try {
    const response1 = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: TEST_USER_ID }),
    });

    const duration1 = Date.now() - start1;
    const data1 = await response1.json();

    console.log(`✅ Response time: ${duration1}ms`);
    console.log(`   Success: ${data1.success}`);

    if (data1.success && data1.recommendation) {
      console.log(`   Beach: ${data1.recommendation.beach?.name || "Unknown"}`);
      console.log(`   Score: ${data1.recommendation.score?.toFixed(1) || "N/A"}`);
      console.log(`   Partial success: ${data1.recommendation.partial_success || false}`);
      console.log(`   Beaches: ${data1.recommendation.available_beaches_count}/${data1.recommendation.total_beaches_count}`);
    } else if (!data1.success) {
      console.log(`   Error: ${data1.error || "Unknown error"}`);
    } else {
      console.log(`   No recommendation available`);
    }
  } catch (error) {
    console.error(`❌ Test 1 failed:`, error);
    return;
  }

  // Wait 2 seconds
  console.log("\n⏳ Waiting 2 seconds before second call...\n");
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Second API call (should use cache if fresh)
  console.log("📊 Test 2: Second API call (should use cache if fresh)");
  const start2 = Date.now();

  try {
    const response2 = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: TEST_USER_ID }),
    });

    const duration2 = Date.now() - start2;
    const data2 = await response2.json();

    console.log(`✅ Response time: ${duration2}ms`);
    console.log(`   Success: ${data2.success}`);

    if (data2.success && data2.recommendation) {
      console.log(`   Beach: ${data2.recommendation.beach?.name || "Unknown"}`);
      console.log(`   Score: ${data2.recommendation.score?.toFixed(1) || "N/A"}`);
    }

    // Performance check
    console.log("\n📈 Performance Analysis:");
    console.log(`   First call: ${duration1}ms`);
    console.log(`   Second call: ${duration2}ms`);

    if (duration2 < 2000 && duration2 < duration1) {
      console.log(`   ✅ Cache appears to be working! (second call much faster)`);
    } else if (duration2 < 2000) {
      console.log(`   ✅ Both calls fast, likely using cache`);
    } else {
      console.log(`   ⚠️ Second call still slow (${duration2}ms), cache may not be working`);
    }
  } catch (error) {
    console.error(`❌ Test 2 failed:`, error);
    return;
  }

  // Test 3: Check database for cached forecasts
  console.log("\n📊 Test 3: Checking database for cached forecasts");

  try {
    const supabase = createSupabaseServiceRoleClient();

    // Get user's candidate beaches
    const { data: profile } = await supabase
      .from("profiles")
      .select("home_beach_id")
      .eq("id", TEST_USER_ID)
      .single();

    const { data: favorites } = await supabase
      .from("favorite_beaches")
      .select("beach_id")
      .eq("user_id", TEST_USER_ID);

    const beachIds = [
      profile?.home_beach_id,
      ...(favorites?.map(f => f.beach_id) || []),
    ].filter(Boolean);

    console.log(`   Candidate beaches: ${beachIds.length}`);

    // Check for cached forecasts
    for (const beachId of beachIds) {
      const { data: forecasts, count } = await supabase
        .from("enhanced_forecasts")
        .select("id, beach_id, updated_at, data_source", { count: "exact" })
        .eq("beach_id", beachId)
        .gte("forecast_date", new Date().toISOString().split("T")[0])
        .limit(1);

      if (forecasts && forecasts.length > 0) {
        const forecast = forecasts[0];
        const hoursSinceUpdate = (Date.now() - new Date(forecast.updated_at).getTime()) / (1000 * 60 * 60);
        console.log(`   ✅ Beach ${beachId.substring(0, 8)}... has ${count} cached forecasts`);
        console.log(`      Source: ${forecast.data_source}, Age: ${hoursSinceUpdate.toFixed(1)}h`);
      } else {
        console.log(`   ⚠️ Beach ${beachId.substring(0, 8)}... has NO cached forecasts`);
      }
    }
  } catch (error) {
    console.error(`❌ Database check failed:`, error);
  }

  console.log("\n✅ Cache verification complete!");
  console.log("\n💡 Check the server logs above for cache hit/miss messages:");
  console.log("   - Look for '✅ [fetchForecast] Using fresh cached data...'");
  console.log("   - Or '🔄 [fetchForecast] Generating fresh forecast...'");
}

verifyCache().catch(console.error);
