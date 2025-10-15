/**
 * Performance Optimization Verification Script
 * 
 * Run this script to verify that database performance optimizations
 * are working correctly.
 * 
 * Usage: npx tsx scripts/verify-performance-optimizations.ts
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface CheckResult {
  name: string;
  status: "✅" | "⚠️" | "❌";
  message: string;
  details?: string;
}

const results: CheckResult[] = [];

async function checkIndex(
  indexName: string,
  tableName: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("pg_indexes" as any, {
    schemaname: "public",
    tablename: tableName,
  } as any);

  if (error) {
    // Try alternative query
    const query = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND tablename = $1
        AND indexname = $2
    `;

    try {
      const { data: indexData, error: indexError } = await supabase.rpc(
        "execute_sql" as any,
        {
          query,
          params: [tableName, indexName],
        } as any
      );

      return !indexError && indexData && indexData.length > 0;
    } catch {
      return false;
    }
  }

  return data && data.some((idx: any) => idx.indexname === indexName);
}

async function verifyIndexes() {
  console.log("\n📊 Verifying Database Indexes...\n");

  const indexes = [
    { name: "idx_intel_posts_location_active", table: "intel_posts" },
    { name: "idx_intel_posts_tag_active", table: "intel_posts" },
    { name: "idx_beaches_name_with_coords", table: "beaches" },
    { name: "idx_beaches_location", table: "beaches" },
    { name: "idx_session_invitations_invitee_id_status", table: "session_invitations" },
    { name: "idx_comments_session_created", table: "comments" },
    { name: "idx_session_likes_session_user", table: "session_likes" },
  ];

  for (const index of indexes) {
    const exists = await checkIndex(index.name, index.table);

    results.push({
      name: `Index: ${index.name}`,
      status: exists ? "✅" : "❌",
      message: exists
        ? `Index exists on ${index.table}`
        : `Index missing on ${index.table}`,
      details: exists
        ? undefined
        : "Run: supabase db push to apply migrations",
    });
  }
}

async function verifyQueryPerformance() {
  console.log("\n⚡ Verifying Query Performance...\n");

  // Test intel posts geospatial query
  const start1 = Date.now();
  const { error: intelError } = await supabase.rpc("get_nearby_intel_posts", {
    center_lat: 32.7157,
    center_lng: -117.1611,
    limit_count: 20,
    radius_miles: 25,
    tag_filter: null,
  });
  const intelTime = Date.now() - start1;

  results.push({
    name: "Intel Posts Query",
    status: intelTime < 100 ? "✅" : intelTime < 500 ? "⚠️" : "❌",
    message: `Completed in ${intelTime}ms`,
    details:
      intelTime > 100
        ? "Consider running ANALYZE on intel_posts table"
        : undefined,
  });

  if (intelError) {
    results.push({
      name: "Intel Posts Query Error",
      status: "❌",
      message: intelError.message,
    });
  }

  // Test beach query
  const start2 = Date.now();
  const { data: beaches, error: beachError } = await supabase
    .from("beaches")
    .select("id, name, latitude, longitude")
    .order("name")
    .limit(100);
  const beachTime = Date.now() - start2;

  results.push({
    name: "Beach List Query",
    status: beachTime < 50 ? "✅" : beachTime < 200 ? "⚠️" : "❌",
    message: `Completed in ${beachTime}ms (${beaches?.length || 0} results)`,
    details:
      beachTime > 50
        ? "Indexes may need time to build or analyze"
        : undefined,
  });

  if (beachError) {
    results.push({
      name: "Beach Query Error",
      status: "❌",
      message: beachError.message,
    });
  }
}

async function checkRealtimeTables() {
  console.log("\n🔌 Verifying Realtime Configuration...\n");

  const tables = [
    "intel_posts",
    "intel_post_confirmations",
    "session_invitations",
    "comments",
    "session_likes",
    "user_follows",
  ];

  for (const table of tables) {
    // Check if table exists
    const { error } = await supabase.from(table as any).select("id").limit(1);

    results.push({
      name: `Realtime Table: ${table}`,
      status: error ? "❌" : "✅",
      message: error ? `Error: ${error.message}` : "Table accessible",
    });
  }
}

async function printResults() {
  console.log("\n" + "=".repeat(70));
  console.log("  DATABASE PERFORMANCE OPTIMIZATION VERIFICATION");
  console.log("=".repeat(70) + "\n");

  const passed = results.filter((r) => r.status === "✅").length;
  const warnings = results.filter((r) => r.status === "⚠️").length;
  const failed = results.filter((r) => r.status === "❌").length;

  results.forEach((result) => {
    console.log(`${result.status} ${result.name}`);
    console.log(`   ${result.message}`);
    if (result.details) {
      console.log(`   ℹ️  ${result.details}`);
    }
    console.log();
  });

  console.log("=".repeat(70));
  console.log(`\n📈 Summary: ${passed} passed | ${warnings} warnings | ${failed} failed\n`);

  if (failed > 0) {
    console.log("❌ Some checks failed. Review the errors above.");
    console.log("💡 Tip: Ensure migrations are applied with 'supabase db push'\n");
    process.exit(1);
  } else if (warnings > 0) {
    console.log("⚠️  Some checks have warnings. Performance may not be optimal.");
    console.log("💡 Tip: Run ANALYZE on tables or wait for indexes to build\n");
  } else {
    console.log("✅ All optimizations verified successfully!\n");
  }
}

async function main() {
  console.log("🚀 Starting Performance Optimization Verification...\n");

  try {
    await verifyIndexes();
    await verifyQueryPerformance();
    await checkRealtimeTables();
    await printResults();
  } catch (error) {
    console.error("\n❌ Verification failed:", error);
    process.exit(1);
  }
}

main();

