#!/usr/bin/env node
/**
 * Query all beaches from Supabase to audit current content
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function queryBeaches() {
  console.log("🏖️  Querying beaches from Supabase...\n");

  // Get total count
  const { count, error: countError } = await supabase
    .from("beaches")
    .select("*", { count: "exact", head: true });

  if (countError) {
    console.error("❌ Error counting beaches:", countError);
    process.exit(1);
  }

  console.log(`📊 Total beaches in database: ${count}\n`);

  // Get all beaches with key fields
  const { data: beaches, error } = await supabase
    .from("beaches")
    .select("name, region, break_type, skill_level, hazards")
    .order("name");

  if (error) {
    console.error("❌ Error fetching beaches:", error);
    process.exit(1);
  }

  // Group by region
  const byRegion = {};
  beaches.forEach((beach) => {
    const region = beach.region || "Unknown";
    if (!byRegion[region]) {
      byRegion[region] = [];
    }
    byRegion[region].push(beach);
  });

  console.log("🗺️  BEACHES BY REGION:\n");
  console.log("=".repeat(80));

  Object.keys(byRegion)
    .sort()
    .forEach((region) => {
      console.log(`\n📍 ${region} (${byRegion[region].length} beaches)`);
      console.log("-".repeat(80));
      byRegion[region].forEach((beach) => {
        const breakType = beach.break_type || "unknown";
        const skill = beach.skill_level || "unknown";
        const hazards =
          beach.hazards?.length > 0 ? ` [⚠️  ${beach.hazards.join(", ")}]` : "";
        console.log(`  • ${beach.name} - ${breakType}, ${skill}${hazards}`);
      });
    });

  console.log("\n" + "=".repeat(80));
  console.log(`\n✅ Total: ${count} beaches`);

  // Check for key beaches
  const keyBeaches = [
    "Tourmaline Surf Park",
    "Swami's Beach",
    "Swamis Beach",
    "Sunset Cliffs",
    "Point Loma",
    "Windansea",
    "Blacks",
    "La Jolla Shores",
    "Pacific Beach",
    "Ocean Beach",
  ];

  console.log("\n🔍 KEY BEACH CHECK:\n");
  keyBeaches.forEach((name) => {
    const found = beaches.find(
      (b) =>
        b.name.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(b.name.toLowerCase())
    );
    console.log(`  ${found ? "✅" : "❌"} ${name}`);
  });

  // Find beaches with missing metadata
  const missingMetadata = beaches.filter(
    (b) =>
      !b.break_type ||
      b.break_type === "unknown" ||
      !b.skill_level ||
      b.skill_level === "unknown"
  );

  console.log("\n" + "=".repeat(80));
  console.log(
    `\n⚠️  BEACHES MISSING METADATA (${missingMetadata.length} beaches):\n`
  );
  console.log("=".repeat(80));

  // Group missing beaches by region
  const missingByRegion = {};
  missingMetadata.forEach((beach) => {
    const region = beach.region || "Unknown";
    if (!missingByRegion[region]) {
      missingByRegion[region] = [];
    }
    missingByRegion[region].push(beach);
  });

  Object.keys(missingByRegion)
    .sort()
    .forEach((region) => {
      console.log(`\n📍 ${region} (${missingByRegion[region].length} beaches)`);
      console.log("-".repeat(80));
      missingByRegion[region].forEach((beach) => {
        const missing = [];
        if (!beach.break_type || beach.break_type === "unknown")
          missing.push("break_type");
        if (!beach.skill_level || beach.skill_level === "unknown")
          missing.push("skill_level");
        if (!beach.hazards || beach.hazards.length === 0)
          missing.push("hazards");
        console.log(`  • ${beach.name} - Missing: ${missing.join(", ")}`);
      });
    });

  console.log("\n" + "=".repeat(80));
  console.log(`\n📊 SUMMARY:`);
  console.log(`  Total beaches: ${count}`);
  console.log(`  Complete metadata: ${count - missingMetadata.length}`);
  console.log(`  Missing metadata: ${missingMetadata.length}`);
  console.log(
    `  Completion rate: ${Math.round(
      ((count - missingMetadata.length) / count) * 100
    )}%`
  );
}

queryBeaches().catch(console.error);
