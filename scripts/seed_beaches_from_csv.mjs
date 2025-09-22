#!/usr/bin/env node

// Seed beaches from a CSV and attach camera URLs to beach_sources
// Usage:
//   node scripts/seed_beaches_from_csv.mjs --file ./docs/quiver_owner_cams_seed_CA_HI_WA_OR.csv [--dry-run]
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

// Prefer project .env.local and also load base .env to fill any missing vars
const localEnvPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(localEnvPath)) {
  loadEnv({ path: localEnvPath });
}
// Always load .env afterwards so any vars missing in .env.local are populated
loadEnv();

function parseArgs(argv) {
  const args = { file: null, dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--file") {
      args.file = argv[i + 1];
      i += 1;
    } else if (a.startsWith("--file=")) {
      args.file = a.split("=")[1];
    }
  }
  return args;
}

function coerceNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function inferCountry(region) {
  // CSV covers CA, HI, WA, OR → USA for now
  if (!region) return "USA";
  const r = (region || "").toString().trim().toLowerCase();
  if (["california", "hawaii", "wa", "washington", "or", "oregon"].includes(r))
    return "USA";
  return "USA";
}

function chooseCameraUrl(row) {
  const embedPolicy = (row.embed_policy || "").toString().trim().toLowerCase();
  const platformUrl = (row.platform_url || "").toString().trim();
  const pageUrl = (row.page_url || "").toString().trim();

  // Prefer embeddable platform URLs
  if (embedPolicy === "licensed-widget" || embedPolicy === "platform-allowed") {
    if (platformUrl) return platformUrl;
  }
  // Otherwise, store page URL for link-out
  if (pageUrl) return pageUrl;
  // Fallback to platform URL if present even without explicit policy
  if (platformUrl) return platformUrl;
  return null;
}

function normalizeName(name) {
  return (name || "").toString().trim();
}

async function ensureSupabase(dryRun) {
  if (dryRun) return null;
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing required environment: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function upsertBeach(supabase, row) {
  const name = normalizeName(row.name);
  const region = (row.region || "").toString().trim();
  const lat = coerceNumber(row.lat);
  const lng = coerceNumber(row.lng);
  const country = inferCountry(region);
  const location =
    region ||
    (lat !== null && lng !== null
      ? `${lat.toFixed(6)}, ${lng.toFixed(6)}`
      : null);

  // Try to find existing beach by case-insensitive name (tolerate duplicates by picking first)
  const { data: matches, error: findErr } = await supabase
    .from("beaches")
    .select("id, name")
    .ilike("name", name)
    .limit(1);
  if (findErr) throw findErr;
  const existing =
    Array.isArray(matches) && matches.length > 0 ? matches[0] : null;

  if (existing && existing.id) {
    const { error: updErr } = await supabase
      .from("beaches")
      .update({
        region,
        country,
        latitude: lat,
        longitude: lng,
        location,
      })
      .eq("id", existing.id);
    if (updErr) throw updErr;
    return { id: existing.id, action: "updated" };
  }

  const insertPayload = {
    name,
    region,
    country,
    latitude: lat,
    longitude: lng,
    location,
  };
  const { data: inserted, error: insErr } = await supabase
    .from("beaches")
    .insert(insertPayload)
    .select("id")
    .single();
  if (insErr) throw insErr;
  return { id: inserted.id, action: "inserted" };
}

async function upsertCameraUrl(supabase, beachId, cameraUrl) {
  if (!cameraUrl) return "skipped";
  const { error } = await supabase
    .from("beach_sources")
    .upsert(
      { beach_id: beachId, camera_url: cameraUrl },
      { onConflict: "beach_id" }
    );
  if (error) throw error;
  return "upserted";
}

async function isBeachSourcesAvailable(supabase) {
  try {
    const { error } = await supabase
      .from("beach_sources")
      .select("beach_id")
      .limit(1);
    if (error) return false;
    return true;
  } catch (_) {
    return false;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const inputPath = args.file
    ? path.isAbsolute(args.file)
      ? args.file
      : path.join(process.cwd(), args.file)
    : path.join(
        __dirname,
        "..",
        "docs",
        "quiver_owner_cams_seed_CA_HI_WA_OR.csv"
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

  console.log(`📄 Loaded ${records.length} rows from ${inputPath}`);

  if (args.dryRun) {
    let withCoords = 0;
    let withCam = 0;
    for (const r of records) {
      if (coerceNumber(r.lat) !== null && coerceNumber(r.lng) !== null)
        withCoords += 1;
      if (chooseCameraUrl(r)) withCam += 1;
    }
    console.log(`🔍 Dry run summary:`);
    console.log(`- Rows with coords: ${withCoords}`);
    console.log(`- Rows with camera URL: ${withCam}`);
    console.log(`- No database writes performed.`);
    return;
  }

  const supabase = await ensureSupabase(false);

  let inserted = 0;
  let updated = 0;
  let cams = 0;
  let failures = 0;

  const cameraTableAvailable = await isBeachSourcesAvailable(supabase);
  if (!cameraTableAvailable) {
    console.warn(
      "⚠️  beach_sources table not found or not accessible. Skipping camera URL upserts."
    );
  }

  for (const row of records) {
    const name = normalizeName(row.name);
    if (!name) continue;

    const lat = coerceNumber(row.lat);
    const lng = coerceNumber(row.lng);
    if (lat === null || lng === null) {
      console.warn(`⚠️  Skipping beach without coords: ${name}`);
      continue;
    }

    try {
      const res = await upsertBeach(supabase, row);
      if (res.action === "inserted") inserted += 1;
      else updated += 1;

      if (cameraTableAvailable) {
        const cameraUrl = chooseCameraUrl(row);
        const camRes = await upsertCameraUrl(supabase, res.id, cameraUrl);
        if (camRes === "upserted") cams += 1;
      }
    } catch (rowErr) {
      failures += 1;
      const name = normalizeName(row.name);
      const msg = rowErr && rowErr.message ? rowErr.message : String(rowErr);
      const details = rowErr && rowErr.details ? rowErr.details : "";
      const code = rowErr && rowErr.code ? rowErr.code : "";
      console.error(`❌ Row failed for beach "${name}":`, {
        code,
        msg,
        details,
      });
    }
  }

  console.log(
    `✅ Done. Inserted: ${inserted}, Updated: ${updated}, Camera URLs upserted: ${cams}, Failures: ${failures}`
  );
}

main().catch((err) => {
  console.error(
    "❌ Seed failed:",
    err instanceof Error ? err.stack || err.message : JSON.stringify(err)
  );
  process.exit(1);
});
