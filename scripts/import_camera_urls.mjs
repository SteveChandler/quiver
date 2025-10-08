#!/usr/bin/env node

// Import camera URLs from quiver_cams_by_spot.csv into beach_sources table
// Usage:
//   node scripts/import_camera_urls.mjs [--dry-run]
// Env (required when not --dry-run):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const localEnvPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(localEnvPath)) {
  loadEnv({ path: localEnvPath });
}
loadEnv();

function parseArgs(argv) {
  const args = { dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--dry-run") args.dryRun = true;
  }
  return args;
}

// Priority order for embed policies (higher number = better)
const EMBED_PRIORITY = {
  "licensed-widget": 4,
  "platform-allowed": 3,
  "link-only": 2,
  unknown: 1,
};

function getBestCamera(cameras) {
  if (cameras.length === 1) return cameras[0];

  // Sort by embed priority (descending)
  const sorted = [...cameras].sort((a, b) => {
    const priorityA = EMBED_PRIORITY[a.embed_policy] || 0;
    const priorityB = EMBED_PRIORITY[b.embed_policy] || 0;
    return priorityB - priorityA;
  });

  return sorted[0];
}

async function upsertCameraUrl(supabase, beachId, cameraUrl) {
  const { error } = await supabase
    .from("beach_sources")
    .upsert(
      { beach_id: beachId, camera_url: cameraUrl, ndbc_buoy_ids: [] },
      { onConflict: "beach_id" }
    );
  if (error) throw error;
}

async function main() {
  const args = parseArgs(process.argv);
  const inputPath = path.join(
    __dirname,
    "..",
    "docs",
    "quiver_cams_by_spot.csv"
  );

  if (!fs.existsSync(inputPath)) {
    console.error(`❌ CSV not found: ${inputPath}`);
    process.exit(1);
  }

  const csvText = fs.readFileSync(inputPath, "utf8");
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`📄 Loaded ${records.length} camera entries from CSV`);

  // Group cameras by spot_id
  const camerasBySpot = {};
  for (const record of records) {
    const spotId = record.spot_id?.trim();
    const pageUrl = record.page_url?.trim();
    const embedPolicy = record.embed_policy?.trim() || "unknown";

    if (!spotId || !pageUrl) continue;

    if (!camerasBySpot[spotId]) {
      camerasBySpot[spotId] = [];
    }

    camerasBySpot[spotId].push({
      spot_id: spotId,
      beach_name: record.beach_name,
      cam_name: record.cam_name,
      page_url: pageUrl,
      embed_policy: embedPolicy,
      owner: record.owner,
    });
  }

  const uniqueBeaches = Object.keys(camerasBySpot).length;
  console.log(`🏖️  Found cameras for ${uniqueBeaches} unique beaches`);

  // Select best camera for each beach
  const updates = [];
  for (const [spotId, cameras] of Object.entries(camerasBySpot)) {
    const bestCamera = getBestCamera(cameras);
    updates.push({
      beach_id: spotId,
      beach_name: bestCamera.beach_name,
      camera_url: bestCamera.page_url,
      cam_name: bestCamera.cam_name,
      embed_policy: bestCamera.embed_policy,
      owner: bestCamera.owner,
      alternatives: cameras.length > 1 ? cameras.length : 0,
    });
  }

  if (args.dryRun) {
    console.log(`\n🔍 DRY RUN - No database writes will be performed\n`);
    console.log(`Would update ${updates.length} beaches:\n`);

    // Group by embed policy for summary
    const byPolicy = {};
    for (const u of updates) {
      byPolicy[u.embed_policy] = (byPolicy[u.embed_policy] || 0) + 1;
    }

    console.log(`📊 By embed policy:`);
    for (const [policy, count] of Object.entries(byPolicy).sort(
      (a, b) => (EMBED_PRIORITY[b[0]] || 0) - (EMBED_PRIORITY[a[0]] || 0)
    )) {
      console.log(`  - ${policy}: ${count} beaches`);
    }

    console.log(`\n📋 Sample updates (first 10):`);
    for (const u of updates.slice(0, 10)) {
      const altText =
        u.alternatives > 0 ? ` (+${u.alternatives} alternates)` : "";
      console.log(
        `  - ${u.beach_name}: ${u.cam_name} [${u.embed_policy}]${altText}`
      );
      console.log(`    ${u.camera_url}`);
    }

    console.log(
      `\n✅ Dry run complete. Run without --dry-run to apply changes.`
    );
    return;
  }

  // Actual database updates
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  console.log(`\n🚀 Updating ${updates.length} beaches with camera URLs...\n`);

  let success = 0;
  let failures = 0;

  for (const update of updates) {
    try {
      await upsertCameraUrl(supabase, update.beach_id, update.camera_url);
      const altText =
        update.alternatives > 0 ? ` (+${update.alternatives} alternates)` : "";
      console.log(
        `✅ ${update.beach_name}: ${update.cam_name} [${update.embed_policy}]${altText}`
      );
      success++;
    } catch (err) {
      console.error(`❌ Failed for ${update.beach_name}:`, err.message);
      failures++;
    }
  }

  console.log(`\n✅ Import complete!`);
  console.log(`   Success: ${success}`);
  console.log(`   Failures: ${failures}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});


