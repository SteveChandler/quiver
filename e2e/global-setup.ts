import { chromium, FullConfig } from "@playwright/test";
import path from "path";
import fs from "fs";
import { config } from "dotenv";

// Load environment variables from .env files
config();
// Load test-specific env vars if available (gracefully handles missing file)
config({ path: ".env.test" });

async function globalSetup(config: FullConfig) {
  console.log("🚀 Starting global setup...");

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    const baseUrl =
      process.env.BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const signInUrl = new URL("/auth/sign-in", baseUrl).toString();

    // Check if we can access the sign-in page (indicates app is running)
    console.log("🌐 Navigating to sign-in page...");
    await page.goto(signInUrl);
    await page.waitForLoadState("load");

    // Check if sign-in form is available with more flexible selectors
    await page.waitForTimeout(2000); // Give page time to load

    const emailField = page
      .locator('input[type="email"], input[id="email"], input[name="email"]')
      .first();
    const passwordField = page
      .locator(
        'input[type="password"], input[id="password"], input[name="password"]'
      )
      .first();
    const signInButton = page
      .locator(
        'button[type="submit"], button:has-text("Sign In"), button:has-text("sign in")'
      )
      .first();

    const hasSignInForm =
      (await emailField.isVisible().catch(() => false)) &&
      (await passwordField.isVisible().catch(() => false)) &&
      (await signInButton.isVisible().catch(() => false));

    if (!hasSignInForm) {
      console.log(
        "⚠️  Sign-in form not found, creating empty auth state and continuing..."
      );

      // Ensure .auth directory exists
      const authDir = path.join(__dirname, "..", ".auth");
      if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
        console.log("📁 Created .auth directory");
      }

      // Create an empty auth state file
      const authFile = path.join(authDir, "user.json");
      const emptyAuthState = {
        cookies: [],
        origins: [],
      };
      fs.writeFileSync(authFile, JSON.stringify(emptyAuthState, null, 2));
      console.log(
        "💾 Created empty authentication state for unauthenticated tests"
      );
      console.log("🏁 Global setup completed for unauthenticated testing");

      await browser.close();
      return;
    }

    // Use environment variables or fallback credentials
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;

    // If no test credentials are provided, create an empty auth state for unauthenticated tests
    if (!testEmail || !testPassword) {
      console.log(
        "⚠️  No test credentials found. Setting up for unauthenticated tests..."
      );

      // Ensure .auth directory exists
      const authDir = path.join(__dirname, "..", ".auth");
      if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
        console.log("📁 Created .auth directory");
      }

      // Create an empty auth state file
      const authFile = path.join(authDir, "user.json");
      const emptyAuthState = {
        cookies: [],
        origins: [],
      };
      fs.writeFileSync(authFile, JSON.stringify(emptyAuthState, null, 2));
      console.log(
        `💾 Created empty authentication state for unauthenticated tests`
      );

      console.log("🏁 Global setup completed for unauthenticated testing");
      await browser.close();
      return;
    }

    // Seed test user via service-role-backed test endpoint (non-prod only)
    try {
      if (testEmail && testPassword) {
        const seedUrl = new URL("/api/test/auth/seed-user", baseUrl).toString();
        const resp = await page.request.post(seedUrl, {
          data: { email: testEmail, password: testPassword },
          headers: { "Content-Type": "application/json" },
        });
        console.log(`🔧 Seed user response: ${resp.status()}`);
      }
    } catch (seedErr) {
      console.warn("⚠️  Seed user request failed (continuing):", seedErr);
    }

    console.log("📝 Attempting to sign in with test credentials...");

    // Fill the form carefully with proper waits
    await emailField.click();
    await emailField.fill(testEmail);
    await passwordField.click();
    await passwordField.fill(testPassword);

    // Use the specific submit button selector we fixed earlier
    const submitButton = page
      .locator('button[type="submit"]')
      .filter({ hasText: /sign in/i });
    await submitButton.click();

    // Wait for successful authentication by checking for redirect to home page
    console.log("⏳ Waiting for authentication...");
    try {
      // Wait for either successful redirect to home or profile page
      await page.waitForURL(
        (url) =>
          url.pathname === "/" ||
          url.pathname.startsWith("/profile") ||
          url.pathname.startsWith("/map"),
        { timeout: 10000 }
      );
      console.log("✅ Authentication successful!");
    } catch (error) {
      // Attempt signup fallback then retry sign-in once
      try {
        console.warn("⚠️  Authentication failed - attempting sign-up fallback...");
        await page.goto(new URL("/auth/sign-up", baseUrl).toString());
        await page.waitForLoadState("load");

        const suEmail = page
          .locator('input[type="email"], input[id="email"], input[name="email"]')
          .first();
        const suPassword = page
          .locator('input[type="password"], input[id="password"], input[name="password"]')
          .first();
        const suSubmit = page
          .locator('button[type="submit"]').filter({ hasText: /sign up/i });

        if (
          (await suEmail.isVisible().catch(() => false)) &&
          (await suPassword.isVisible().catch(() => false))
        ) {
          await suEmail.fill(testEmail!);
          await suPassword.fill(testPassword!);
          await suSubmit.click();
          // Give the app time to process sign-up; some setups auto-login or redirect
          await page.waitForTimeout(2000);
        }

        // Retry sign-in once
        await page.goto(signInUrl);
        await page.waitForLoadState("load");
        await emailField.fill(testEmail!);
        await passwordField.fill(testPassword!);
        await submitButton.click();
        await page.waitForURL(
          (url) => !url.pathname.startsWith("/auth"),
          { timeout: 10000 }
        );
        console.log("✅ Authentication successful after sign-up fallback!");
      } catch (signupErr) {
        // Final fallback: create empty auth state
        const currentUrl = page.url();
        console.warn(
          `⚠️  Authentication/sign-up failed, continuing unauthenticated. URL: ${currentUrl}`
        );

        const authDir = path.join(__dirname, "..", ".auth");
        if (!fs.existsSync(authDir)) {
          fs.mkdirSync(authDir, { recursive: true });
          console.log("📁 Created .auth directory");
        }

        const authFile = path.join(authDir, "user.json");
        const emptyAuthState = { cookies: [], origins: [] };
        fs.writeFileSync(authFile, JSON.stringify(emptyAuthState, null, 2));
        console.log(`💾 Created empty authentication state for unauthenticated tests`);

        console.log("🏁 Global setup completed for unauthenticated testing");
        await browser.close();
        return;
      }
    }

    // Ensure .auth directory exists
    const authDir = path.join(__dirname, "..", ".auth");
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
      console.log("📁 Created .auth directory");
    }

    // Save the current authentication state
    const authFile = path.join(authDir, "user.json");
    await page.context().storageState({ path: authFile });
    console.log(`💾 Saved authentication state to ${authFile}`);

    // Verify the file was created and has content
    if (fs.existsSync(authFile)) {
      const stats = fs.statSync(authFile);
      console.log(`📊 Authentication file size: ${stats.size} bytes`);
    } else {
      throw new Error("Failed to create authentication state file");
    }
  } catch (error) {
    console.error("❌ Global setup failed:", error);
    throw error;
  } finally {
    await browser.close();
  }

  console.log("🏁 Global setup completed successfully");
}

export default globalSetup;
