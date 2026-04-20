#!/usr/bin/env tsx
/**
 * One-off trigger: regenerate enhanced_forecasts for a single beach using
 * the local code (new anchor path) and prod DB. Writes to prod. Run this
 * instead of waiting for the next enhanced-forecast-sync cron tick when
 * you need immediate feedback.
 *
 * Usage:
 *   npx tsx scripts/trigger-beach-regen.ts <beach-slug>
 */

import { config } from "dotenv";
config({ path: ".env.production.local" });

import { updateBeachForecast } from "../lib/utils/forecast-server-utils";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const slug = process.argv[2] ?? "ocean-beach-pier";
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: beach, error } = await sb
    .from("beaches")
    .select("id, name, slug, features")
    .eq("slug", slug)
    .single();
  if (error || !beach) throw new Error(`Beach lookup failed: ${error?.message}`);

  console.log(`\nBeach: ${beach.name} (${beach.id})`);
  console.log(`Features: ${JSON.stringify(beach.features)}\n`);

  const result = await updateBeachForecast(beach.id);
  console.log(`Regeneration complete: ${result.forecastsGenerated} forecast rows written`);

  const nowMinus1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const nowPlus1h = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const { data: rows } = await sb
    .from("enhanced_forecasts")
    .select("forecast_at, wave_height, data_source, updated_at")
    .eq("beach_id", beach.id)
    .gte("forecast_at", nowMinus1h)
    .lte("forecast_at", nowPlus1h)
    .order("forecast_at", { ascending: true });

  console.log(`\nForecast rows within ±1h of now:`);
  for (const r of rows ?? []) {
    const age = Math.round((Date.now() - Date.parse(r.updated_at)) / 1000);
    console.log(`  ${r.forecast_at}  ${r.wave_height}  (${r.data_source}, written ${age}s ago)`);
  }
  console.log();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
