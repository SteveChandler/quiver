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
      console.log("🔐 Authentication required, creating test session...");

      try {
        // Try to create a test session programmatically using Supabase
        const { createClient } = await import("@supabase/supabase-js");

        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // Use environment variables for test credentials, with fallbacks
        const testEmail = process.env.TEST_USER_EMAIL || "test@quiver.com";
        const testPassword =
          process.env.TEST_USER_PASSWORD || "testpassword123";

        console.log(`📝 Attempting to sign in with email: ${testEmail}`);

        // Try to sign in first
        let { data, error } = await supabase.auth.signInWithPassword({
          email: testEmail,
          password: testPassword,
        });

        // If sign in fails, try to sign up
        if (error && error.message.includes("Invalid login credentials")) {
          console.log("📝 User doesn't exist, creating test user...");

          const signUpResult = await supabase.auth.signUp({
            email: testEmail,
            password: testPassword,
          });

          if (signUpResult.error) {
            console.log(
              "❌ Failed to create test user:",
              signUpResult.error.message
            );
          } else {
            console.log("✅ Test user created successfully");
            // Try to sign in again
            const signInResult = await supabase.auth.signInWithPassword({
              email: testEmail,
              password: testPassword,
            });
            data = signInResult.data;
            error = signInResult.error;
          }
        }

        if (error) {
          console.log("❌ Authentication failed:", error.message);
          console.log("   Tests will run in unauthenticated mode");
        } else if (data.session) {
          console.log("✅ Authentication successful");

          // Set the session cookies in the browser context
          await page.evaluate(
            ({ session }) => {
              // Store session in localStorage (Supabase's default behavior)
              localStorage.setItem(
                `sb-${new URL(
                  process.env.NEXT_PUBLIC_SUPABASE_URL!
                ).hostname.replace(/\./g, "-")}-auth-token`,
                JSON.stringify({
                  access_token: session.access_token,
                  refresh_token: session.refresh_token,
                  expires_at: session.expires_at,
                  token_type: session.token_type,
                  user: session.user,
                })
              );
            },
            { session: data.session }
          );

          // Navigate to home to verify authentication
          await page.goto("http://localhost:3000");
          await page.waitForTimeout(2000);
        }
      } catch (setupError) {
        console.log("❌ Error during programmatic auth setup:", setupError);
        console.log("   Falling back to manual sign-in...");

        // Fallback to manual sign-in
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
          console.log("📝 Attempting manual sign-in...");

          const testEmail = process.env.TEST_USER_EMAIL || "test@quiver.com";
          const testPassword =
            process.env.TEST_USER_PASSWORD || "testpassword123";

          await emailField.fill(testEmail);
          await passwordField.fill(testPassword);
          await signInButton.click();
          await page.waitForTimeout(3000);

          const isAuthenticated = !page.url().includes("/auth/sign-in");
          if (isAuthenticated) {
            console.log("✅ Manual authentication successful");
          } else {
            console.log("⚠️  Manual authentication failed");
          }
        }
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
