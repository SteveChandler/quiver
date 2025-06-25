import { chromium, FullConfig } from "@playwright/test";
import path from "path";
import fs from "fs";
import { config } from "dotenv";

// Load environment variables from .env file
config();

async function globalSetup(config: FullConfig) {
  console.log("🚀 Starting global setup...");

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Check if we can access the sign-in page (indicates app is running)
    console.log("🌐 Navigating to sign-in page...");
    await page.goto("http://localhost:3000/auth/sign-in");
    await page.waitForLoadState("networkidle");

    // Check if sign-in form is available
    const emailField = page.getByLabel(/email/i);
    const passwordField = page.getByLabel(/password/i);
    const signInButton = page.getByRole("button", { name: /sign in/i });

    const hasSignInForm =
      (await emailField.isVisible().catch(() => false)) &&
      (await passwordField.isVisible().catch(() => false)) &&
      (await signInButton.isVisible().catch(() => false));

    if (!hasSignInForm) {
      throw new Error(
        "Sign-in form not found. Is the app running on http://localhost:3000?"
      );
    }

    console.log("📝 Attempting to sign in with test credentials...");

    // Use environment variables or fallback credentials
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;

    if (!testEmail || !testPassword) {
      throw new Error(
        "Missing required environment variables: TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in .env file"
      );
    }

    await emailField.fill(testEmail);
    await passwordField.fill(testPassword);
    await signInButton.click();

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
      // Check if we're still on sign-in page (authentication failed)
      const currentUrl = page.url();
      if (currentUrl.includes("/auth/sign-in")) {
        throw new Error(
          "Authentication failed - still on sign-in page. Check your credentials."
        );
      }
      // If we're somewhere else, assume success but log the location
      console.log(`⚠️  Authentication completed, current URL: ${currentUrl}`);
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
