/**
 * ML Stats Query Script
 * Queries production Supabase for ML pipeline health metrics
 *
 * Usage: npx tsx scripts/ml-stats.ts
 * Requires: .env.production.local with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *           and optionally FLY_API_TOKEN for deployment health
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

// Also load .env for FLY_API_TOKEN if not in production.local
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: false });
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

// Fly.io configuration
const FLY_API_TOKEN = process.env.FLY_API_TOKEN;
const FLY_APP_NAME = process.env.FLY_APP_NAME || 'quiver-ml';
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'https://quiver-ml.fly.dev';

interface RegistryEntry {
  version: string;
  status: string;
  holdout_improvement_pct: number | null;
  created_at: string;
  deployed_at: string | null;
  training_samples: number | null;
  notes: string | null;
}

interface FlyMachine {
  id: string;
  state: string;
  config?: {
    guest?: {
      memory_mb?: number;
    };
  };
  updated_at?: string;
}

interface FlyHealthResponse {
  status: string;
  model_version?: string;
  model_loaded?: boolean;
}

interface DeploymentHealth {
  healthEndpoint: FlyHealthResponse | null;
  healthError: string | null;
  machines: Array<{
    id: string;
    state: string;
    memoryMb: number | null;
    updatedAt: string | null;
  }> | null;
  machinesError: string | null;
}

/**
 * Query the model registry for recent entries
 */
async function queryModelRegistry(): Promise<{ data: RegistryEntry[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('ml_model_registry')
    .select('version, status, holdout_improvement_pct, created_at, deployed_at, training_samples, notes')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    return { data: null, error: error.message };
  }
  return { data: data as RegistryEntry[], error: null };
}

/**
 * Query Fly.io for deployment health
 */
async function queryFlyDeploymentHealth(): Promise<DeploymentHealth> {
  const result: DeploymentHealth = {
    healthEndpoint: null,
    healthError: null,
    machines: null,
    machinesError: null,
  };

  // Query health endpoint (no auth needed)
  try {
    const healthResponse = await fetch(`${ML_SERVICE_URL}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (healthResponse.ok) {
      result.healthEndpoint = await healthResponse.json();
    } else {
      result.healthError = `Health endpoint returned ${healthResponse.status}`;
    }
  } catch (err) {
    result.healthError = err instanceof Error ? err.message : 'Unknown error';
  }

  // Query machines API (requires FLY_API_TOKEN)
  if (!FLY_API_TOKEN) {
    result.machinesError = 'FLY_API_TOKEN not configured';
    return result;
  }

  try {
    const machinesUrl = `https://api.machines.dev/v1/apps/${FLY_APP_NAME}/machines`;
    const machinesResponse = await fetch(machinesUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${FLY_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (machinesResponse.ok) {
      const machines: FlyMachine[] = await machinesResponse.json();
      result.machines = machines.map(m => ({
        id: m.id,
        state: m.state,
        memoryMb: m.config?.guest?.memory_mb || null,
        updatedAt: m.updated_at || null,
      }));
    } else {
      const errorText = await machinesResponse.text();
      result.machinesError = `Machines API returned ${machinesResponse.status}: ${errorText}`;
    }
  } catch (err) {
    result.machinesError = err instanceof Error ? err.message : 'Unknown error';
  }

  return result;
}

async function main() {
  try {
    // Query 1: Pipeline Health (via RPC if function exists, otherwise direct query)
    const { data: healthMetrics, error: healthError } = await supabase.rpc("get_ml_health_metrics");

    // Query 2: Weekly Model Performance (via RPC if function exists)
    const { data: weeklyMetrics, error: weeklyError } = await supabase.rpc("get_ml_weekly_metrics");

    // Query 3: Model Registry (last 5 entries)
    const registryResult = await queryModelRegistry();

    // Query 4: Fly.io Deployment Health
    const deploymentHealth = await queryFlyDeploymentHealth();

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
      metrics24h,
      modelRegistry: registryResult.data,
      modelRegistryError: registryResult.error,
      deploymentHealth: {
        healthEndpoint: deploymentHealth.healthEndpoint,
        healthError: deploymentHealth.healthError,
        machines: deploymentHealth.machines,
        machinesError: deploymentHealth.machinesError,
      },
    }));
  } catch (err) {
    console.error(JSON.stringify({ error: "Unexpected error", details: String(err) }));
    process.exit(1);
  }
}

main();
