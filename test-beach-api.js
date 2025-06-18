#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testDatabase() {
  console.log("🔍 Testing database connection...");

  // Get beaches
  const { data: beaches, error: beachError } = await supabase
    .from("beaches")
    .select("id, name")
    .limit(3);

  if (beachError) {
    console.error("❌ Beach query error:", beachError);
    return;
  }

  console.log("✅ Found beaches:", beaches);

  if (beaches && beaches.length > 0) {
    const beachId = beaches[0].id;
    console.log(
      `\n🔍 Testing forecasts for beach: ${beaches[0].name} (${beachId})`
    );

    // Get forecasts for this beach
    const { data: forecasts, error: forecastError } = await supabase
      .from("enhanced_forecasts")
      .select("*")
      .eq("beach_id", beachId)
      .limit(5);

    if (forecastError) {
      console.error("❌ Forecast query error:", forecastError);
      return;
    }

    console.log("✅ Found forecasts:", forecasts?.length || 0);
    if (forecasts && forecasts.length > 0) {
      console.log("Sample forecast:", forecasts[0]);
    }

    // Test the API endpoint
    console.log("\n🔍 Testing API endpoint...");
    try {
      const response = await fetch(
        `http://localhost:3001/api/forecasts/update-enhanced?beachId=${beachId}&days=1`
      );
      const apiData = await response.json();
      console.log("API Response:", JSON.stringify(apiData, null, 2));
    } catch (apiError) {
      console.error("❌ API test error:", apiError);
    }
  }
}

testDatabase().catch(console.error);
