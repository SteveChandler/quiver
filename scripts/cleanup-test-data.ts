#!/usr/bin/env npx tsx
/**
 * Test Data Cleanup Script
 *
 * Cleans up orphaned test data from integration tests that may have failed
 * before their afterAll cleanup hooks ran.
 *
 * Usage:
 *   yarn test:cleanup           # Actually delete test data
 *   yarn test:cleanup:dry       # Preview what would be deleted
 *
 * Options:
 *   --dry-run   Show what would be deleted without actually deleting
 *   --verbose   Show detailed output
 *
 * This script identifies test users by their email patterns:
 *   - *@test.com
 *   - *@quiver-test.local
 *   - test-*@*.com
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load environment variables (tries multiple files)
config({ path: ".env.local" });
config({ path: ".env" });
config({ path: ".env.playwright.local" });

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const VERBOSE = args.includes("--verbose");

// Test email patterns to match
const TEST_EMAIL_PATTERNS = [
  "%@test.com",
  "%@quiver-test.local",
  "test-%@%.com",
  "e2e-%@%.com",
  "integration-%@%.com",
];

// Tables with user_id foreign keys (order matters for cascade)
const USER_DATA_TABLES = [
  "session_invitations",
  "session_likes",
  "comments",
  "sessions",
  "intel_post_confirmations",
  "intel_post_reports",
  "intel_posts",
  "user_follows",
  "user_surf_preferences",
  "user_implicit_preferences",
  "user_beach_affinity",
  "user_xp",
  "user_badges",
  "boards",
  "device_tokens",
  "profiles",
];

interface CleanupStats {
  table: string;
  count: number;
}

async function main() {
  console.log("=== Test Data Cleanup Script ===\n");

  if (DRY_RUN) {
    console.log("DRY RUN MODE - No data will be deleted\n");
  }

  // Validate environment
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Error: Missing environment variables");
    console.error("Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    console.error("\nRun with: npx dotenv -e .env.local -- ts-node scripts/cleanup-test-data.ts");
    process.exit(1);
  }

  // Create admin client
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log("Connected to Supabase\n");

  // Find test users
  console.log("Finding test users...");
  const testUserIds: string[] = [];

  for (const pattern of TEST_EMAIL_PATTERNS) {
    const { data: users, error } = await supabase.auth.admin.listUsers({
      perPage: 1000,
    });

    if (error) {
      console.error(`Error listing users: ${error.message}`);
      continue;
    }

    // Filter by email pattern (convert SQL LIKE to regex)
    const regex = new RegExp(
      "^" + pattern.replace(/%/g, ".*").replace(/\./g, "\\.") + "$",
      "i"
    );

    for (const user of users.users) {
      if (user.email && regex.test(user.email)) {
        if (!testUserIds.includes(user.id)) {
          testUserIds.push(user.id);
          if (VERBOSE) {
            console.log(`  Found test user: ${user.email} (${user.id})`);
          }
        }
      }
    }
  }

  console.log(`\nFound ${testUserIds.length} test user(s)\n`);

  if (testUserIds.length === 0) {
    console.log("No test data to clean up.");
    process.exit(0);
  }

  // Clean up user data from each table
  const stats: CleanupStats[] = [];

  for (const table of USER_DATA_TABLES) {
    try {
      // Determine the column name (profiles uses 'id', others use 'user_id')
      const column = table === "profiles" ? "id" : "user_id";

      if (DRY_RUN) {
        // Count what would be deleted
        const { count, error } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true })
          .in(column, testUserIds);

        if (error) {
          if (VERBOSE) console.log(`  Skipping ${table}: ${error.message}`);
          continue;
        }

        stats.push({ table, count: count || 0 });
        if (VERBOSE && count && count > 0) {
          console.log(`  Would delete ${count} row(s) from ${table}`);
        }
      } else {
        // Actually delete
        const { error, count } = await supabase
          .from(table)
          .delete({ count: "exact" })
          .in(column, testUserIds);

        if (error) {
          if (VERBOSE) console.log(`  Skipping ${table}: ${error.message}`);
          continue;
        }

        stats.push({ table, count: count || 0 });
        if (count && count > 0) {
          console.log(`  Deleted ${count} row(s) from ${table}`);
        }
      }
    } catch (err) {
      if (VERBOSE) {
        console.log(`  Error with ${table}: ${err}`);
      }
    }
  }

  // Delete auth users
  if (!DRY_RUN) {
    console.log("\nDeleting auth users...");
    let deletedUsers = 0;

    for (const userId of testUserIds) {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) {
        if (VERBOSE) console.log(`  Failed to delete user ${userId}: ${error.message}`);
      } else {
        deletedUsers++;
      }
    }

    console.log(`  Deleted ${deletedUsers} auth user(s)`);
  } else {
    console.log(`\nWould delete ${testUserIds.length} auth user(s)`);
  }

  // Summary
  console.log("\n=== Summary ===\n");

  const totalRows = stats.reduce((sum, s) => sum + s.count, 0);
  const tablesAffected = stats.filter((s) => s.count > 0);

  if (DRY_RUN) {
    console.log(`Would delete ${totalRows} row(s) across ${tablesAffected.length} table(s)`);
    console.log(`Would delete ${testUserIds.length} auth user(s)`);
    console.log("\nRun without --dry-run to perform cleanup");
  } else {
    console.log(`Deleted ${totalRows} row(s) across ${tablesAffected.length} table(s)`);
    console.log(`Deleted ${testUserIds.length} auth user(s)`);
  }

  if (VERBOSE && tablesAffected.length > 0) {
    console.log("\nBreakdown by table:");
    for (const s of tablesAffected) {
      console.log(`  ${s.table}: ${s.count}`);
    }
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
