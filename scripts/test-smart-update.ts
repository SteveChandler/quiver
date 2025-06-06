#!/usr/bin/env tsx

/**
 * Test Smart Forecast Update (Development)
 *
 * This script tests the smart forecast update endpoint locally.
 * Run with: npx tsx scripts/test-smart-update.ts
 */

import {
  getBeachesToUpdate,
  BEACHES_TO_UPDATE,
  BEACHES_TO_SKIP,
} from "../lib/beach-update-config";

async function testSmartUpdate() {
  console.log("🏄‍♂️ Testing Smart Forecast Update Configuration\n");

  // Test configuration
  console.log("📋 CONFIGURATION TEST:");
  console.log("=".repeat(50));

  const targetBeaches = getBeachesToUpdate(9);
  console.log(`🎯 Beaches to update (${targetBeaches.length}):`, targetBeaches);

  console.log(`\n❌ Beaches to skip (${BEACHES_TO_SKIP.length}):`);
  BEACHES_TO_SKIP.slice(0, 10).forEach((beach) => console.log(`   • ${beach}`));
  if (BEACHES_TO_SKIP.length > 10) {
    console.log(`   ... and ${BEACHES_TO_SKIP.length - 10} more`);
  }

  console.log(`\n📊 Strategy breakdown:`);
  BEACHES_TO_UPDATE.forEach((strategy) => {
    const coverage = strategy.provides_fallback_for?.length || 0;
    console.log(
      `   🏖️  ${strategy.name} (Priority ${strategy.priority}) → covers ${
        coverage + 1
      } beaches`
    );
    if (strategy.provides_fallback_for) {
      console.log(
        `      Fallback for: ${strategy.provides_fallback_for.join(", ")}`
      );
    }
  });

  // Calculate potential coverage
  const totalCoverage = BEACHES_TO_UPDATE.reduce((total, strategy) => {
    return total + 1 + (strategy.provides_fallback_for?.length || 0);
  }, 0);

  console.log(`\n📈 EFFICIENCY:`);
  console.log(`   API Calls: ${targetBeaches.length}/10 daily quota`);
  console.log(`   Coverage: ~${totalCoverage} beaches`);
  console.log(
    `   Efficiency: ${(totalCoverage / targetBeaches.length).toFixed(
      1
    )}x coverage per API call`
  );

  // Test API call (if server is running)
  console.log(`\n🌐 API TEST:`);
  console.log("=".repeat(50));

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const token = process.env.CRON_SECRET_TOKEN;

  if (!token) {
    console.log("⚠️  CRON_SECRET_TOKEN not set in environment");
    console.log("   Add to .env.local: CRON_SECRET_TOKEN=your-secret-here");
    return;
  }

  try {
    console.log(`📞 Calling: ${baseUrl}/api/cron/smart-forecast-update`);
    console.log("🔐 Using debug mode to test without using API quota...");

    const response = await fetch(
      `${baseUrl}/api/cron/smart-forecast-update?token=${token}&debug=true&maxUpdates=3`,
      {
        method: "GET",
        headers: { "Cache-Control": "no-cache" },
      }
    );

    const data = await response.json();

    if (response.ok) {
      console.log("✅ Smart update endpoint is working!");
      console.log("\n📊 Response summary:");
      if (data.summary) {
        Object.entries(data.summary).forEach(([key, value]) => {
          console.log(`   ${key}: ${value}`);
        });
      }

      if (data.results) {
        console.log("\n🏖️  Beach results:");
        data.results.slice(0, 5).forEach((result: any) => {
          const status = result.success ? "✅" : "❌";
          console.log(
            `   ${status} ${result.beach} - ${result.strategy || "No strategy"}`
          );
        });
      }
    } else {
      console.log("❌ Endpoint failed:", data.error);
    }
  } catch (error) {
    console.log("🔌 Server not running or endpoint unreachable");
    console.log("   Start server with: npm run dev");
    console.log("   Then run this script again");
  }

  console.log("\n🚀 NEXT STEPS:");
  console.log("=".repeat(50));
  console.log("1. Start your dev server: npm run dev");
  console.log(
    '2. Test manually: curl -X GET "http://localhost:3000/api/cron/smart-forecast-update?token=YOUR_TOKEN&debug=true"'
  );
  console.log(
    "3. For production: Set up GitHub Actions (see endpoint comments)"
  );
  console.log("4. Schedule: 9 AM daily PST for best surfer engagement");
}

// Run if called directly
if (require.main === module) {
  testSmartUpdate().catch(console.error);
}

export { testSmartUpdate };
