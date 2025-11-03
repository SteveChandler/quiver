/**
 * Script to create test sessions with photos for E2E tests
 * Run with: npx ts-node e2e/scripts/create-photo-test-data.ts
 *
 * Environment:
 * - Uses BASE_URL from environment (defaults to http://localhost:3000)
 * - Uses authentication from e2e/.auth/state.json
 */

import { chromium } from "@playwright/test";
import { ensureSessionsWithPhotos } from "../utils/session-test-data";
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.playwright', override: true });
dotenv.config();

async function main() {
  const baseURL = process.env.BASE_URL || 'http://localhost:3000';

  console.log("Creating test sessions with photos...");
  console.log(`Environment: ${baseURL}`);
  console.log(`Using auth state from: e2e/.auth/state.json\n`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: "e2e/.auth/state.json",
    baseURL,
  });
  const page = await context.newPage();

  try {
    const sessionIds = await ensureSessionsWithPhotos(page, 5);
    console.log(`\n✅ Created ${sessionIds.length} test sessions with photos`);
    console.log("Session IDs:", sessionIds);
  } catch (error) {
    console.error("❌ Failed to create test sessions:", error);
    process.exit(1);
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }
}

main();
