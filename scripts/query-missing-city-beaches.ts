#!/usr/bin/env tsx

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { createObjectCsvWriter } from "csv-writer";
import path from "path";

// Use production credentials
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing Supabase credentials!");
  process.exit(1);
}

if (!MAPBOX_TOKEN) {
  console.warn("⚠️ Missing Mapbox token - reverse geocoding will be skipped");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface BeachMissingCity {
  id: string;
  name: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  slug: string;
  region_id: string | null;
  created_at: string;
}

interface BeachWithResearch extends BeachMissingCity {
  reverse_geocode_result: string | null;
  recommended_city: string | null;
  confidence: "High" | "Medium" | "Low";
  source: string;
  notes: string;
}

/**
 * Reverse geocode coordinates to get city name
 */
async function reverseGeocode(
  lat: number,
  lon: number
): Promise<{ city: string | null; confidence: "High" | "Medium" | "Low" }> {
  if (!MAPBOX_TOKEN) {
    return { city: null, confidence: "Low" };
  }

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${MAPBOX_TOKEN}&types=place`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`  ⚠️  Reverse geocode failed for ${lat},${lon}: ${response.statusText}`);
      return { city: null, confidence: "Low" };
    }

    const data = await response.json();

    if (data.features && data.features.length > 0) {
      // Get city from place context
      const cityFeature = data.features.find((f: any) =>
        f.place_type?.includes("place")
      );

      if (cityFeature) {
        const city = cityFeature.text;
        const relevance = cityFeature.relevance || 0;

        // Confidence based on relevance score
        let confidence: "High" | "Medium" | "Low" = "Medium";
        if (relevance >= 0.9) {
          confidence = "High";
        } else if (relevance < 0.7) {
          confidence = "Low";
        }

        return { city, confidence };
      }
    }

    return { city: null, confidence: "Low" };
  } catch (error) {
    console.error(`  ❌ Reverse geocode error for ${lat},${lon}:`, error);
    return { city: null, confidence: "Low" };
  }
}

/**
 * Add delay between API calls to avoid rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main query function
 */
async function queryMissingCityBeaches() {
  console.log("🔍 Querying production database for beaches with missing city names...\n");

  const { data, error } = await supabase
    .from("beaches")
    .select(
      "id, name, state, country, city, latitude, longitude, slug, region_id, created_at"
    )
    .is("city", null)
    .eq("is_private", false)
    .is("deleted_at", null)
    .order("country")
    .order("state")
    .order("name");

  if (error) {
    console.error("❌ Error querying database:", error);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log("✅ No beaches found with missing city names!");
    return;
  }

  console.log(`📊 Found ${data.length} beaches with missing city names\n`);
  console.log("=".repeat(80));

  // Group by country/state for analysis
  const grouped = data.reduce((acc, beach) => {
    const key = `${beach.country}/${beach.state}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(beach);
    return acc;
  }, {} as Record<string, typeof data>);

  // Display summary
  console.log("\n📍 GEOGRAPHIC DISTRIBUTION:\n");
  Object.entries(grouped).forEach(([location, beaches]) => {
    console.log(`   ${location}: ${beaches.length} beaches`);
  });

  console.log("\n" + "=".repeat(80));
  console.log("\n🗺️  RUNNING REVERSE GEOCODING (this may take a few minutes)...\n");

  // Process each beach with reverse geocoding
  const researchedBeaches: BeachWithResearch[] = [];

  for (let i = 0; i < data.length; i++) {
    const beach = data[i];
    console.log(`[${i + 1}/${data.length}] ${beach.name}...`);

    const { city, confidence } = await reverseGeocode(
      beach.latitude,
      beach.longitude
    );

    // Determine source and notes
    let source = "Mapbox Geocoding API";
    let notes = "";
    let recommendedCity = city;

    // Apply overrides for known beaches
    if (beach.name === "Rosarito Beach") {
      recommendedCity = "Rosarito";
      confidence = "High";
      source = "Beach name + Mapbox";
      notes = "Obvious from beach name";
    } else if (beach.name.includes("(Puerto Nuevo)") || beach.name === "K-40") {
      recommendedCity = "Puerto Nuevo";
      confidence = "High";
      source = "Beach name + known location";
      notes = "Puerto Nuevo specified in beach name";
    } else if (beach.name.match(/K-?\d+/) && beach.country === "Mexico") {
      // Kilometer markers in Mexico
      recommendedCity = recommendedCity || "Rosarito";
      source = "Mapbox + kilometer marker pattern";
      notes = "Kilometer marker beach, assigned to nearest city";
    }

    // Additional confidence adjustments
    if (!recommendedCity) {
      confidence = "Low";
      notes = "No city found via reverse geocoding - needs manual research";
    }

    researchedBeaches.push({
      ...beach,
      reverse_geocode_result: city,
      recommended_city: recommendedCity,
      confidence,
      source,
      notes,
    });

    console.log(`  → ${recommendedCity || "Unknown"} (${confidence})`);

    // Add delay to avoid rate limiting (250ms between requests)
    if (i < data.length - 1) {
      await delay(250);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n📊 CONFIDENCE BREAKDOWN:\n");

  const confidenceCounts = researchedBeaches.reduce(
    (acc, beach) => {
      acc[beach.confidence]++;
      return acc;
    },
    { High: 0, Medium: 0, Low: 0 }
  );

  console.log(`   High Confidence: ${confidenceCounts.High} beaches`);
  console.log(`   Medium Confidence: ${confidenceCounts.Medium} beaches`);
  console.log(`   Low Confidence: ${confidenceCounts.Low} beaches`);

  console.log("\n" + "=".repeat(80));
  console.log("\n📋 COMPLETE LIST:\n");

  // Display each beach with details
  researchedBeaches.forEach((beach, index) => {
    const confidenceIcon =
      beach.confidence === "High" ? "✅" : beach.confidence === "Medium" ? "⚠️" : "❌";

    console.log(`${index + 1}. ${beach.name} ${confidenceIcon}`);
    console.log(`   Country: ${beach.country}`);
    console.log(`   State: ${beach.state}`);
    console.log(`   Coordinates: ${beach.latitude}, ${beach.longitude}`);
    console.log(`   Recommended City: ${beach.recommended_city || "NEEDS RESEARCH"}`);
    console.log(`   Confidence: ${beach.confidence}`);
    console.log(`   Source: ${beach.source}`);
    if (beach.notes) {
      console.log(`   Notes: ${beach.notes}`);
    }
    console.log(`   Slug: ${beach.slug}`);
    console.log(`   ID: ${beach.id}`);
    console.log("");
  });

  // Export to CSV
  const outputPath = path.resolve(
    __dirname,
    "../docs/beaches-missing-city-production.csv"
  );

  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: "id", title: "Beach ID" },
      { id: "name", title: "Beach Name" },
      { id: "country", title: "Country" },
      { id: "state", title: "State" },
      { id: "latitude", title: "Latitude" },
      { id: "longitude", title: "Longitude" },
      { id: "reverse_geocode_result", title: "Reverse Geocode Result" },
      { id: "recommended_city", title: "Recommended City" },
      { id: "confidence", title: "Confidence Level" },
      { id: "source", title: "Source" },
      { id: "notes", title: "Notes" },
      { id: "slug", title: "Slug" },
      { id: "region_id", title: "Region ID" },
      { id: "created_at", title: "Created At" },
    ],
  });

  await csvWriter.writeRecords(researchedBeaches);
  console.log("=".repeat(80));
  console.log(`\n✅ Exported data to: ${outputPath}\n`);

  // Summary statistics
  console.log("📈 SUMMARY:\n");
  console.log(`   Total beaches missing cities: ${data.length}`);
  console.log(`   With recommended cities: ${researchedBeaches.filter((b) => b.recommended_city).length}`);
  console.log(`   Needs manual research: ${researchedBeaches.filter((b) => !b.recommended_city).length}`);
  console.log(`   High confidence: ${confidenceCounts.High} (${((confidenceCounts.High / data.length) * 100).toFixed(1)}%)`);
  console.log(`   Medium confidence: ${confidenceCounts.Medium} (${((confidenceCounts.Medium / data.length) * 100).toFixed(1)}%)`);
  console.log(`   Low confidence: ${confidenceCounts.Low} (${((confidenceCounts.Low / data.length) * 100).toFixed(1)}%)`);

  console.log("\n" + "=".repeat(80));
  console.log("\n🎯 NEXT STEPS:\n");
  console.log("   1. Review the CSV file with research results");
  console.log("   2. Manually verify Medium and Low confidence beaches");
  console.log("   3. Create migration file with UPDATE statements");
  console.log("   4. Test migration locally");
  console.log("   5. Deploy to production\n");

  return researchedBeaches;
}

// Run the script
queryMissingCityBeaches()
  .then(() => {
    console.log("✅ Query complete!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Unexpected error:", err);
    process.exit(1);
  });
