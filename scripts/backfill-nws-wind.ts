#!/usr/bin/env node
/**
 * Backfill NWS hourly wind rows into public.marine_forecasts (next 7 days, plus small lookback).
 * Also optionally generates short-horizon wave persistence rows (next 12 hours) so the MV has
 * future wave rows to score against.
 *
 * Why:
 * - Many CDIP-derived wave rows have NULL wind, which skews hourly scoring/rankings.
 * - We ingest wind-only hourly rows from NOAA/NWS (api.weather.gov) with source='nws_wind'
 *   and join them into mv_beach_hourly_scores via nearest timestamp (±90m).
 *
 * Usage:
 * - tsx scripts/backfill-nws-wind.ts
 *
 * Environment Variables Required:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Safety:
 * - Idempotent via upsert on (beach_id, ts, source)
 * - No deletes; only inserts/updates wind-only rows (source='nws_wind')
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { NwsWindService } from "@/lib/services/nws-wind-service";
import fs from "node:fs";

// Load environment variables.
// Default dotenv loads `.env`. Many setups keep remote credentials in `.env.local`.
// If `.env` points at local Supabase (127.0.0.1:54321) and Docker isn't running,
// fall back to `.env.local` or `.env.production.local` (without requiring secrets on the command line).
config();
try {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isLocal =
    url.includes("127.0.0.1:54321") || url.includes("localhost:54321");
  if (isLocal) {
    const candidates = [".env.local", ".env.production.local"];
    for (const p of candidates) {
      if (!fs.existsSync(p)) continue;
      config({ path: p, override: true });
      break;
    }
  }
} catch {
  // ignore dotenv/fs errors; validation below will surface missing config
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function validateEnvironment(): void {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    // eslint-disable-next-line no-console
    console.error("❌ Missing required environment variables:");
    if (!SUPABASE_URL) {
      // eslint-disable-next-line no-console
      console.error("   - NEXT_PUBLIC_SUPABASE_URL");
    }
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      // eslint-disable-next-line no-console
      console.error("   - SUPABASE_SERVICE_ROLE_KEY");
    }
    // eslint-disable-next-line no-console
    console.error("\nPlease check your .env.local file.");
    process.exit(1);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function backfillNwsWind(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log("🌬️ Backfill NWS hourly wind (next 7 days)");
  // eslint-disable-next-line no-console
  console.log("========================================\n");

  validateEnvironment();

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const nws = new NwsWindService();

  const { data: beaches, error: beachError } = await supabase
    .from("beaches")
    .select("id,name,lat,lon")
    .not("lat", "is", null)
    .not("lon", "is", null);

  if (beachError) {
    // eslint-disable-next-line no-console
    console.error("❌ Failed to load beaches:", beachError);
    process.exit(1);
  }

  const beachList = beaches ?? [];
  // eslint-disable-next-line no-console
  console.log(`🏖️ Beaches to process: ${beachList.length}\n`);

  /**
   * NWS `forecastHourly` is forward-looking. It does not provide historical hourly wind.
   * So instead of “last 7 days”, backfill the *next* 7 days (plus a small lookback)
   * to align with Quiver’s “today/near-term” scoring windows.
   */
  const start = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  let totalRows = 0;
  let totalPersistenceRows = 0;
  let successBeaches = 0;
  let failedBeaches = 0;

  for (const b of beachList as Array<{ id: string; name: string; lat: number; lon: number }>) {
    try {
      // eslint-disable-next-line no-console
      console.log(`→ ${b.name} (${b.id})`);

      const points = await nws.fetchHourlyWindPoints({
        lat: b.lat,
        lon: b.lon,
        start,
        end,
      });

      if (!points.length) {
        // eslint-disable-next-line no-console
        console.log("  (no NWS wind coverage)\n");
        successBeaches += 1;
        await sleep(150);
        continue;
      }

      const createdAt = new Date().toISOString();
      const rows = points.map((p) => ({
        beach_id: b.id,
        ts: p.ts,
        created_at: createdAt,
        wind_speed_ms: p.wind_speed_ms,
        wind_direction_deg: p.wind_direction_deg,
        wave_height_m: null,
        wave_period_s: null,
        wave_direction_deg: null,
        source: "nws_wind",
        is_observed: false,
      }));

      // Upsert in chunks to avoid payload limits.
      const chunkSize = 200;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error } = await supabase
          .from("marine_forecasts")
          .upsert(chunk, { onConflict: "beach_id,ts,source" });
        if (error) throw error;
      }

      totalRows += rows.length;
      successBeaches += 1;

      // eslint-disable-next-line no-console
      console.log(`  ✅ upserted ${rows.length} rows\n`);

      /**
       * Generate short-horizon wave persistence rows (next 12h) using the latest observed wave row.
       * This mirrors the cron behavior and ensures mv_beach_hourly_scores has future wave rows
       * that can be scored using the NWS wind rows we just ingested.
       */
      try {
        const { data: latestObserved, error: latestErr } = await supabase
          .from("marine_forecasts")
          .select(
            "ts,wave_height_m,wave_period_s,wave_direction_deg,source,is_observed"
          )
          .eq("beach_id", b.id)
          .eq("is_observed", true)
          .in("source", ["cdip", "ndbc"])
          .order("ts", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!latestErr && latestObserved?.ts) {
          const base: any = latestObserved;
          const hasAnyWave =
            base.wave_height_m != null ||
            base.wave_period_s != null ||
            base.wave_direction_deg != null;

          if (hasAnyWave) {
            const horizonHours = 12;
            const now = new Date();
            const roundedStart = new Date(
              Math.ceil(now.getTime() / 3600000) * 3600000
            );

            const projections: any[] = [];
            for (let h = 0; h <= horizonHours; h += 1) {
              const t = new Date(roundedStart.getTime() + h * 3600000);
              projections.push({
                beach_id: b.id,
                ts: t.toISOString(),
                created_at: createdAt,
                wave_height_m: base.wave_height_m ?? null,
                wave_period_s: base.wave_period_s ?? null,
                wave_direction_deg: base.wave_direction_deg ?? null,
                wind_speed_ms: null,
                wind_direction_deg: null,
                source:
                  base.source === "ndbc" ? "ndbc_persistence" : "cdip_persistence",
                is_observed: false,
              });
            }

            if (projections.length) {
              const chunkSize2 = 200;
              for (let i = 0; i < projections.length; i += chunkSize2) {
                const chunk = projections.slice(i, i + chunkSize2);
                const { error } = await supabase
                  .from("marine_forecasts")
                  .upsert(chunk, { onConflict: "beach_id,ts,source" });
                if (error) throw error;
              }

              totalPersistenceRows += projections.length;
              // eslint-disable-next-line no-console
              console.log(
                `  ✅ upserted ${projections.length} persistence rows\n`
              );
            }
          }
        }
      } catch (pErr) {
        // eslint-disable-next-line no-console
        console.warn(`  ⚠️ persistence backfill failed for ${b.name}`, pErr);
      }

      // small delay to reduce NOAA request rate
      await sleep(150);
    } catch (err) {
      failedBeaches += 1;
      // eslint-disable-next-line no-console
      console.error(`  ❌ failed for ${b.name}:`, err);
      // keep going
      await sleep(150);
    }
  }

  // eslint-disable-next-line no-console
  console.log("✅ Backfill complete\n");
  // eslint-disable-next-line no-console
  console.log("Summary:");
  // eslint-disable-next-line no-console
  console.log(`- beaches ok: ${successBeaches}`);
  // eslint-disable-next-line no-console
  console.log(`- beaches failed: ${failedBeaches}`);
  // eslint-disable-next-line no-console
  console.log(`- total wind rows upserted: ${totalRows}`);
  // eslint-disable-next-line no-console
  console.log(`- total persistence rows upserted: ${totalPersistenceRows}`);
}

if (require.main === module) {
  backfillNwsWind().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("💥 Fatal error:", err);
    process.exit(1);
  });
}

export { backfillNwsWind };











