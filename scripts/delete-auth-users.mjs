#!/usr/bin/env node
// ============================================================================
// DELETE AUTH USERS - Node.js Script using Admin REST API
// ============================================================================
// PURPOSE: Delete auth users via Supabase Admin REST API
// USAGE:
//   1. Run cleanup-auth-users.sql in Supabase SQL Editor first
//   2. Review the list of user IDs to delete
//   3. Set environment variables and run:
//      SERVICE_ROLE_KEY="..." PROJECT_REF="vawdnbbgawichorsjiwe" node delete-auth-users.mjs id1 id2 id3
//   OR with dry-run mode:
//      DRY_RUN=1 SERVICE_ROLE_KEY="..." PROJECT_REF="..." node delete-auth-users.mjs id1 id2
// WARNING: This permanently deletes users. Cannot be undone.
// ============================================================================

import { createInterface } from "readline";

// Colors for output
const colors = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  reset: "\x1b[0m",
};

// Configuration
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;
const PROJECT_REF = process.env.PROJECT_REF;
const DRY_RUN = process.env.DRY_RUN === "1";

// Validation
if (!SERVICE_ROLE_KEY) {
  console.error(
    `${colors.red}ERROR: SERVICE_ROLE_KEY environment variable not set${colors.reset}`
  );
  console.log(
    'Usage: SERVICE_ROLE_KEY="your-key" node delete-auth-users.mjs user_id1 user_id2'
  );
  process.exit(1);
}

if (!PROJECT_REF) {
  console.error(
    `${colors.red}ERROR: PROJECT_REF environment variable not set${colors.reset}`
  );
  console.log(
    'Usage: PROJECT_REF="vawdnbbgawichorsjiwe" node delete-auth-users.mjs user_id1 user_id2'
  );
  process.exit(1);
}

// Get user IDs from command line arguments
const userIds = process.argv.slice(2);

if (userIds.length === 0) {
  console.error(`${colors.red}ERROR: No user IDs provided${colors.reset}`);
  console.log(
    "Usage: node delete-auth-users.mjs user_id1 user_id2 user_id3 ..."
  );
  console.log(
    "Example: node delete-auth-users.mjs 550e8400-e29b-41d4-a716-446655440000"
  );
  process.exit(1);
}

// Display summary
console.log("================================================");
console.log("Auth User Deletion Script");
console.log("================================================");
console.log(`Project: ${PROJECT_REF}`);
console.log(`User IDs to delete: ${userIds.length}`);
console.log(`Dry run: ${DRY_RUN}`);
console.log("================================================\n");

if (DRY_RUN) {
  console.log(
    `${colors.yellow}DRY RUN MODE - No deletions will be performed${colors.reset}\n`
  );
}

/**
 * Delete a single user via Admin REST API
 */
async function deleteUser(userId) {
  const url = `https://${PROJECT_REF}.supabase.co/auth/v1/admin/users/${userId}`;

  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    });

    if (response.status === 200 || response.status === 204) {
      return { success: true, status: response.status };
    } else {
      const body = await response.text();
      return { success: false, status: response.status, error: body };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Prompt user for confirmation
 */
function confirm(question) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "yes");
    });
  });
}

/**
 * Main execution
 */
async function main() {
  // Confirmation prompt (skip in dry run)
  if (!DRY_RUN) {
    console.log(
      `${colors.yellow}WARNING: This will permanently delete ${userIds.length} user(s)${colors.reset}`
    );
    const confirmed = await confirm(
      "Are you sure you want to continue? (yes/no): "
    );

    if (!confirmed) {
      console.log("Aborted.");
      process.exit(0);
    }
    console.log("");
  }

  // Track results
  let successCount = 0;
  let failureCount = 0;

  // Delete each user
  for (const userId of userIds) {
    console.log(`Processing user: ${colors.yellow}${userId}${colors.reset}`);

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would delete user ${userId}`);
      successCount++;
    } else {
      const result = await deleteUser(userId);

      if (result.success) {
        console.log(
          `  ${colors.green}✓ Deleted successfully (HTTP ${result.status})${colors.reset}`
        );
        successCount++;
      } else {
        console.log(`  ${colors.red}✗ Failed${colors.reset}`);
        if (result.status) {
          console.log(
            `  ${colors.red}HTTP Status: ${result.status}${colors.reset}`
          );
        }
        if (result.error) {
          console.log(`  ${colors.red}Error: ${result.error}${colors.reset}`);
        }
        failureCount++;
      }
    }

    console.log("");
  }

  // Summary
  console.log("================================================");
  console.log("Deletion Summary");
  console.log("================================================");
  console.log(`Successful: ${colors.green}${successCount}${colors.reset}`);
  console.log(`Failed: ${colors.red}${failureCount}${colors.reset}`);
  console.log(`Total: ${successCount + failureCount}`);
  console.log("================================================");

  if (DRY_RUN) {
    console.log(
      `\n${colors.yellow}This was a dry run. To execute deletions, run without DRY_RUN=1${colors.reset}`
    );
  }
}

// Run the script
main().catch((error) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
