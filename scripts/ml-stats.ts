/**
 * ML Stats Query Script
 * Queries production Supabase for ML pipeline health metrics
 *
 * Usage: npx tsx scripts/ml-stats.ts
 * Requires: .env.production.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load production env (has the real Supabase URL, not local)
const prodEnvPath = path.join(process.cwd(), ".env.production.local");
if (fs.existsSync(prodEnvPath)) {
  dotenv.config({ path: prodEnvPath });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(JSON.stringify({
    error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.production.local"
  }));
  process.exit(1);
}

// Ensure we're hitting production, not local
if (supabaseUrl.includes("127.0.0.1") || supabaseUrl.includes("localhost")) {
  console.error(JSON.stringify({
    error: "Supabase URL points to local instance. Use .env.production.local for production stats."
  }));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  try {
    // Query 1: Pipeline Health (via RPC if function exists, otherwise direct query)
    const { data: healthMetrics, error: healthError } = await supabase.rpc("get_ml_health_metrics");

    // Query 2: Weekly Model Performance (via RPC if function exists)
    const { data: weeklyMetrics, error: weeklyError } = await supabase.rpc("get_ml_weekly_metrics");

    // Extract 24h metrics from pipeline health (already computed by RPC)
    let metrics24h = null;
    if (healthMetrics && healthMetrics.length > 0) {
      const h = healthMetrics[0];
      metrics24h = {
        matchedLast24h: h.matched_last_24h,
        totalObservable24h: h.total_observable_24h,
        matchRatePct: h.match_rate_24h,
        maeRaw: h.avg_raw_error_24h,
        maeCorrected: h.avg_corrected_error_24h,
        improvementPct: h.improvement_pct_24h
      };
    }

    console.log(JSON.stringify({
      pipelineHealth: healthMetrics || null,
      pipelineHealthError: healthError?.message || null,
      weeklyMetrics: weeklyMetrics || null,
      weeklyMetricsError: weeklyError?.message || null,
      metrics24h
    }));
  } catch (err) {
    console.error(JSON.stringify({ error: "Unexpected error", details: String(err) }));
    process.exit(1);
  }
}

main();
