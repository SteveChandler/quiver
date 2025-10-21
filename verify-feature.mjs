import "dotenv/config";
import { chromium } from "@playwright/test";

(async () => {
  console.log("🚀 Starting verification...");

  const baseUrl =
    (process.env.BASE_URL || "http://localhost:3001").replace(/\/$/, "");
  const email =
    process.env.E2E_USER_EMAIL ||
    process.env.TEST_USER_EMAIL ||
    process.env.TEST_LOGIN_EMAIL;
  const password =
    process.env.E2E_USER_PASSWORD ||
    process.env.TEST_USER_PASSWORD ||
    process.env.TEST_LOGIN_PASSWORD;

  const browser = await chromium.launch({ headless: true });
  let context;
  try {
    context = await browser.newContext();
    const page = await context.newPage();

    // Listen for console logs
    page.on("console", (msg) => {
      const text = msg.text();
      if (
        text.includes("[BestConditionsCards]") ||
        text.includes("[getBestBeachesNearHome]")
      ) {
        console.log("📊 Console:", text);
      }
    });

    if (email && password) {
      console.log("🔐 Signing in with test credentials from environment...");
      try {
        await page.goto(`${baseUrl}/auth/sign-in`, {
          waitUntil: "networkidle",
        });
        await page.fill("#email", email);
        await page.fill("#password", password);

        await Promise.all([
          page
            .waitForNavigation({
              waitUntil: "networkidle",
              timeout: 20000,
            })
            .catch(() => {}),
          page.click('button[type="submit"]'),
        ]);

        if (!page.url().startsWith(baseUrl)) {
          await page
            .waitForURL(
              (url) => url.href.startsWith(`${baseUrl}/`),
              { timeout: 5000 }
            )
            .catch(() => {});
        }

        console.log("✅ Sign-in flow completed.");
      } catch (error) {
        console.error("⚠️ Sign-in attempt failed:", error);
      }
    } else {
      console.log(
        "⚠️ No credentials found in environment (E2E_USER_* or TEST_USER_*). Continuing unauthenticated."
      );
    }

    console.log(`📍 Navigating to ${baseUrl}...`);
    await page.goto(baseUrl, { waitUntil: "networkidle" });

    console.log("⏳ Waiting for page to settle...");
    await page.waitForTimeout(5000);

    // Check if section exists
    const sectionExists = await page
      .locator("text=Best Conditions Near You")
      .count();
    console.log(
      `\n✅ "Best Conditions Near You" section found: ${
        sectionExists > 0 ? "YES" : "NO"
      }`
    );

    if (sectionExists > 0) {
      console.log("🎉 Feature is working!");

      // Try to find beach cards
      const cards = await page.locator('[class*="Card"]').count();
      console.log(`📇 Found ${cards} card elements`);

      // Get page text content
      const content = await page
        .locator("text=Best Conditions Near You")
        .locator("..")
        .textContent();
      console.log(
        `📝 Section content preview: ${content?.substring(0, 200)}...`
      );
    } else {
      console.log("❌ Section not found - feature may not be rendering");

      // Get the whole page text to see what's there
      const bodyText = await page.locator("body").textContent();
      if (bodyText?.includes("Hey,")) {
        console.log("✓ Home page is loading");
      }
      if (bodyText?.includes("Plan Session")) {
        console.log("✓ Action buttons are present");
      }
    }
  } finally {
    if (context) {
      await context.close();
    }
    await browser.close();
    console.log("\n✅ Verification complete!");
  }
})();

