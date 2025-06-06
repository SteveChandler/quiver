import { chromium, FullConfig } from "@playwright/test";
import path from "path";

async function globalSetup(config: FullConfig) {
  console.log("🚀 Starting global setup...");

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Navigate to the app
    await page.goto("http://localhost:3000");

    // Check if we're already authenticated or if we need to sign in
    await page.waitForTimeout(2000);

    // Check if user is already logged in by looking for sign-in elements
    const needsAuth =
      (await page
        .getByText(/sign in|log in|welcome back/i)
        .isVisible()
        .catch(() => false)) || page.url().includes("/auth/sign-in");

    if (needsAuth) {
      console.log("🔐 Authentication required, navigating to sign-in...");

      // Navigate to sign-in page
      await page.goto("http://localhost:3000/auth/sign-in");

      // Check if sign-in form is available
      const emailField = page.getByLabel(/email/i);
      const passwordField = page.getByLabel(/password/i);
      const signInButton = page.getByRole("button", { name: /sign in/i });

      const hasSignInForm =
        (await emailField.isVisible().catch(() => false)) &&
        (await passwordField.isVisible().catch(() => false)) &&
        (await signInButton.isVisible().catch(() => false));

      if (hasSignInForm) {
        console.log("📝 Attempting to sign in with test credentials...");

        // Use environment variables for test credentials, with fallbacks
        const testEmail = process.env.TEST_USER_EMAIL || "test@example.com";
        const testPassword =
          process.env.TEST_USER_PASSWORD || "testpassword123";

        // Fill in credentials
        await emailField.fill(testEmail);
        await passwordField.fill(testPassword);

        // Submit form
        await signInButton.click();

        // Wait for navigation or error
        await page.waitForTimeout(3000);

        // Check if login was successful
        const isAuthenticated =
          !page.url().includes("/auth/sign-in") &&
          !(await page
            .getByText(/invalid|error|incorrect/i)
            .isVisible()
            .catch(() => false));

        if (isAuthenticated) {
          console.log("✅ Authentication successful");
        } else {
          console.log("⚠️  Authentication failed or test credentials not set");
          console.log(
            "   Set TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables for authenticated tests"
          );
        }
      } else {
        console.log(
          "⚠️  Sign-in form not found - authentication may not be implemented yet"
        );
      }
    } else {
      console.log("✅ Already authenticated or no authentication required");
    }

    // Save authentication state regardless of success
    // This will work for both authenticated and unauthenticated states
    const authFile = path.join(__dirname, "..", ".auth", "user.json");
    await page.context().storageState({ path: authFile });

    console.log(`💾 Saved authentication state to ${authFile}`);
  } catch (error) {
    console.log("❌ Error during global setup:", error);
    // Continue anyway - tests will handle unauthenticated state
  } finally {
    await browser.close();
  }

  console.log("🏁 Global setup completed");
}

export default globalSetup;
