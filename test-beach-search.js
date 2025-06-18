#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testBeachSearch() {
  console.log('🔍 Testing beach search for "Ocean Beach"...');

  // Get all beaches to see what names exist
  const { data: beaches, error: beachError } = await supabase
    .from("beaches")
    .select("id, name, location")
    .limit(10);

  if (beachError) {
    console.error("❌ Beach query error:", beachError);
    return;
  }

  console.log(
    "✅ Available beaches:",
    beaches?.map((b) => b.name)
  );

  // Try to search for "Ocean Beach"
  const normalizedSearch = "ocean beach".toLowerCase().trim();
  const matchingBeaches =
    beaches?.filter((beach) => {
      const beachName = beach.name.toLowerCase();
      const beachLocation = (beach.location || "").toLowerCase();

      return (
        beachName.includes(normalizedSearch) ||
        beachLocation.includes(normalizedSearch)
      );
    }) || [];

  console.log('🔍 Matching beaches for "Ocean Beach":', matchingBeaches);

  if (matchingBeaches.length > 0) {
    const beach = matchingBeaches[0];
    console.log(`✅ Found beach: ${beach.name} (${beach.id})`);

    // Test the forecast API call
    console.log("\n🔍 Testing forecast API call...");
    try {
      const response = await fetch(
        `http://localhost:3001/api/forecasts/update-enhanced?beachId=${beach.id}&days=1`
      );
      const data = await response.json();

      if (data.success) {
        console.log("✅ API call successful");

        // Test the specific line that's failing
        const today = new Date().toISOString().split("T")[0];
        console.log(`🔍 Today's date: ${today}`);
        console.log(
          `🔍 Available dates:`,
          Object.keys(data.forecastsByDate || {})
        );

        if (data.forecastsByDate) {
          const todaysForecasts = data.forecastsByDate[today] || [];
          console.log(`✅ Today's forecasts found: ${todaysForecasts.length}`);

          if (todaysForecasts.length > 0) {
            console.log("✅ Beach search should work!");
          } else {
            console.log(
              "⚠️  No forecasts for today, but data exists for other dates"
            );
          }
        } else {
          console.log("❌ No forecastsByDate in response");
        }
      } else {
        console.log("❌ API call failed:", data.error);
      }
    } catch (apiError) {
      console.error("❌ API call error:", apiError);
    }
  } else {
    console.log('❌ No beach found matching "Ocean Beach"');
    console.log("💡 Try searching for one of the available beaches instead");
  }
}

testBeachSearch().catch(console.error);
