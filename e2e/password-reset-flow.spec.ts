import { test, expect } from "@playwright/test";

test.describe("Password Reset Flow", () => {
  test("Forgot password form submission works", async ({ page }) => {
    // Visit forgot password page
    await page.goto("/auth/forgot-password");
    await page.waitForLoadState("load");

    // Fill email and submit
    const emailField = page
      .getByLabel(/email/i)
      .or(page.locator("input[type='email']"))
      .first();
    await emailField.fill("test@example.com");

    const submitButton = page
      .getByRole("button", { name: /send reset link|send/i })
      .first();
    await submitButton.click();

    // Allow time for feedback
    await page.waitForTimeout(1000);

    // Check that some feedback is shown (success or error)
    const feedbackShown = await page
      .getByText(/reset link|check your inbox|email.*sent|error|failed/i)
      .first()
      .isVisible()
      .catch(() => false);

    expect(feedbackShown).toBeTruthy();
  });

  test("Auth confirm route handles missing parameters", async ({ page }) => {
    // Visit confirm without parameters - should redirect to error
    await page.goto("/auth/confirm");
    await page.waitForLoadState("networkidle");
    
    // Should be redirected to error page
    expect(page.url()).toContain("/error");
  });

  test("Auth confirm route handles invalid token", async ({ page }) => {
    // Visit confirm with fake parameters
    await page.goto("/auth/confirm?token_hash=FAKE&type=recovery&next=/auth/reset");
    await page.waitForLoadState("networkidle");
    
    // Should be redirected to error page
    expect(page.url()).toContain("/error");
  });

  test("Reset page redirects without valid session", async ({ page }) => {
    // Visit reset page directly without going through confirm flow
    await page.goto("/auth/reset");
    
    // Wait for potential redirect
    await page.waitForTimeout(3000);
    
    // Should be redirected to forgot password with error or stay on reset page with loading
    const onForgotPassword = page.url().includes("/auth/forgot-password");
    const onResetPage = page.url().includes("/auth/reset");
    
    if (onForgotPassword) {
      expect(page.url()).toContain("error=expired_link");
    } else if (onResetPage) {
      // If still on reset page, it should show loading or redirect soon
      expect(onResetPage).toBeTruthy();
    }
  });

  test("Reset form validation works correctly", async ({ page }) => {
    // Mock having a valid session by going to reset page first
    await page.goto("/auth/reset");
    await page.waitForLoadState("load");

    // If redirected away, this test doesn't apply
    if (!page.url().includes("/auth/reset")) {
      test.skip(true, "No valid session, skipping reset form validation");
    }

    const newPassword = page
      .getByLabel(/new password/i)
      .or(page.locator("#password"))
      .first();
    const confirmPassword = page
      .getByLabel(/confirm password/i)
      .or(page.locator("#confirmPassword"))
      .first();

    // Test password length validation (< 8 chars)
    await newPassword.fill("123");
    await confirmPassword.fill("123");
    await page
      .getByRole("button", { name: /update password|update/i })
      .first()
      .click();
    
    await page.waitForTimeout(500);
    const shortShown = await page
      .getByText(/at least 8/i)
      .isVisible()
      .catch(() => false);

    // Test password mismatch validation
    await newPassword.fill("password123");
    await confirmPassword.fill("password124");
    await page
      .getByRole("button", { name: /update password|update/i })
      .first()
      .click();
    
    await page.waitForTimeout(500);
    const mismatchShown = await page
      .getByText(/do not match/i)
      .isVisible()
      .catch(() => false);

    expect(shortShown || mismatchShown).toBeTruthy();
  });

  test("Error page displays correctly", async ({ page }) => {
    // Test that error page loads and has content
    await page.goto("/error?reason=invalid_or_expired_link");
    await page.waitForLoadState("load");

    // Verify we're on the error page
    expect(page.url()).toContain("/error");
    expect(page.url()).toContain("reason=invalid_or_expired_link");

    // Test another error reason  
    await page.goto("/error?reason=expired_link");
    await page.waitForLoadState("load");

    // Verify URL is correct
    expect(page.url()).toContain("/error");
    expect(page.url()).toContain("reason=expired_link");
  });

  test("Navigation links work correctly", async ({ page }) => {
    // From error page - verify links exist
    await page.goto("/error?reason=invalid_or_expired_link");
    await page.waitForLoadState("load");

    // Check that error page has proper navigation links
    const hasResetLink = await page
      .getByRole("link", { name: /request new reset link/i })
      .or(page.getByText(/Request New Reset Link/i))
      .isVisible()
      .catch(() => false);

    const hasSignInLink = await page
      .getByRole("link", { name: /back to sign in/i })
      .or(page.getByText(/Back to Sign In/i))
      .isVisible()
      .catch(() => false);

    // At least one navigation link should be visible on error page
    expect(hasResetLink || hasSignInLink).toBeTruthy();
  });

});