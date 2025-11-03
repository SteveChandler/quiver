/**
 * Script to create test sessions with photos for E2E tests
 * Run with: npx ts-node e2e/scripts/create-photo-test-data.ts
 */

import { chromium } from "@playwright/test";
import { ensureSessionsWithPhotos } from "../utils/session-test-data";

async function main() {
  console.log("Creating test sessions with photos...");

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: "e2e/.auth/state.json",
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
