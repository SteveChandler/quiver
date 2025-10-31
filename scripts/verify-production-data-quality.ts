#!/usr/bin/env tsx

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verifyDataQuality() {
  console.log("🔍 Verifying Production Data Quality...\n");
  console.log("=".repeat(80));

  // Query 1: Location completeness
  console.log("\n📊 LOCATION COMPLETENESS:\n");

  const { data: completeness, error: compError } = await supabase.rpc(
    "exec_sql",
    {
      query: `
        SELECT
          CASE
            WHEN city IS NULL THEN 'Missing City'
            WHEN state IS NULL THEN 'Missing State'
            WHEN country IS NULL THEN 'Missing Country'
            ELSE 'Complete'
          END as status,
          COUNT(*) as beach_count,
          ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
        FROM beaches
        WHERE is_private = false AND deleted_at IS NULL
        GROUP BY
          CASE
            WHEN city IS NULL THEN 'Missing City'
            WHEN state IS NULL THEN 'Missing State'
            WHEN country IS NULL THEN 'Missing Country'
            ELSE 'Complete'
          END
        ORDER BY beach_count DESC;
      `,
    }
  );

  if (compError) {
    // Try direct query instead
    const { data: beaches } = await supabase
      .from("beaches")
      .select("city, state, country")
      .eq("is_private", false)
      .is("deleted_at", null);

    if (beaches) {
      const complete = beaches.filter(
        (b) => b.city && b.state && b.country
      ).length;
      const total = beaches.length;
      const missing = total - complete;

      console.log(`   Complete: ${complete} beaches (${((complete / total) * 100).toFixed(2)}%)`);
      console.log(`   Missing City: ${beaches.filter((b) => !b.city).length} beaches`);
      console.log(`   Missing State: ${beaches.filter((b) => !b.state).length} beaches`);
      console.log(`   Missing Country: ${beaches.filter((b) => !b.country).length} beaches`);
      console.log(`   Total: ${total} beaches`);
    }
  }

  // Query 2: Total counts
  console.log("\n📈 OVERALL STATISTICS:\n");

  const { count: totalBeaches } = await supabase
    .from("beaches")
    .select("*", { count: "exact", head: true })
    .eq("is_private", false)
    .is("deleted_at", null);

  const { data: locations } = await supabase
    .from("beaches")
    .select("country, state, city")
    .eq("is_private", false)
    .is("deleted_at", null);

  if (locations) {
    const uniqueLocations = new Set(
      locations
        .filter((l) => l.city && l.state && l.country)
        .map((l) => `${l.country}|${l.state}|${l.city}`)
    ).size;

    const uniqueCountries = new Set(locations.map((l) => l.country)).size;
    const uniqueStates = new Set(locations.map((l) => l.state)).size;
    const uniqueCities = new Set(
      locations.filter((l) => l.city).map((l) => l.city)
    ).size;

    console.log(`   Total Public Beaches: ${totalBeaches}`);
    console.log(`   Unique Locations: ${uniqueLocations}`);
    console.log(`   Unique Countries: ${uniqueCountries}`);
    console.log(`   Unique States: ${uniqueStates}`);
    console.log(`   Unique Cities: ${uniqueCities}`);
  }

  // Query 3: Location distribution (top 20)
  console.log("\n📍 TOP 20 LOCATIONS BY BEACH COUNT:\n");

  const { data: distribution } = await supabase
    .from("beaches")
    .select("country, state, city")
    .eq("is_private", false)
    .is("deleted_at", null);

  if (distribution) {
    const locationCounts = distribution.reduce((acc, beach) => {
      if (beach.city && beach.state && beach.country) {
        const key = `${beach.country}/${beach.state}/${beach.city}`;
        acc[key] = (acc[key] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const sorted = Object.entries(locationCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20);

    sorted.forEach(([location, count], index) => {
      console.log(`   ${index + 1}. ${location}: ${count} beaches`);
    });
  }

  // Query 4: Locations with 3+ beaches (viable for location pages)
  console.log("\n🎯 VIABLE LOCATIONS (3+ beaches):\n");

  if (distribution) {
    const locationCounts = distribution.reduce((acc, beach) => {
      if (beach.city && beach.state && beach.country) {
        const key = `${beach.country}/${beach.state}/${beach.city}`;
        acc[key] = (acc[key] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const viable = Object.entries(locationCounts)
      .filter(([, count]) => count >= 3)
      .sort(([, a], [, b]) => b - a);

    console.log(`   Total viable locations: ${viable.length}`);
    viable.forEach(([location, count]) => {
      console.log(`   - ${location}: ${count} beaches`);
    });
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n✅ Data Quality Verification Complete!\n");
}

verifyDataQuality()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  });
