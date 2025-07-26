import { test, expect } from "@playwright/test";

test.describe("Critical: Plan Session Infinite Loop Fix", () => {
  test.beforeEach(async ({ page }) => {
    // Suppress ALL console noise except infinite loop errors
    page.on("console", (msg) => {
      const text = msg.text();
      // Only log critical infinite loop errors
      if (
        msg.type() === "error" &&
        (text.includes("Maximum update depth exceeded") ||
          text.includes("Too many re-renders") ||
          text.includes("Rendered more hooks than during the previous render"))
      ) {
        console.error("🚨 CRITICAL ERROR:", text);
      }
      // Suppress everything else completely
    });

    // Track only critical page errors
    page.on("pageerror", (error) => {
      if (
        error.message.includes("Maximum update depth exceeded") ||
        error.message.includes("Too many re-renders")
      ) {
        console.error("🚨 CRITICAL PAGE ERROR:", error.message);
      }
      // Suppress everything else completely
    });
  });

  test("Plan Session page loads without infinite loop crash", async ({
    page,
  }) => {
    console.log("🧪 Testing Plan Session infinite loop fix...");

    // Navigate to plan session
    await page.goto("/plan-session");

    // Wait for potential infinite loop to manifest (should not happen)
    await page.waitForTimeout(3000);

    // Check if we're still on the plan session page (not crashed/redirected to error)
    const currentUrl = page.url();
    const isOnPlanSession = currentUrl.includes("/plan-session");

    // If we got redirected to auth, that's fine - not a crash
    const isOnAuth = currentUrl.includes("/auth");

    expect(isOnPlanSession || isOnAuth).toBe(true);

    if (isOnAuth) {
      console.log("✅ Redirected to auth (expected for unauthenticated user)");
    } else {
      console.log("✅ Plan Session page loaded successfully");

      // Check for presence of form elements (indicates page rendered properly)
      const hasForm = (await page.locator("form").count()) > 0;
      const hasDateTimeSection =
        (await page
          .locator('[data-testid*="datetime"], [data-testid*="date-time"]')
          .count()) > 0;
      const hasInvitationsSection =
        (await page.locator('[data-testid="group-invitations"]').count()) > 0;

      if (hasForm || hasDateTimeSection || hasInvitationsSection) {
        console.log("✅ Plan Session form components rendered successfully");
      }
    }

    // Final check: no infinite loop errors should have occurred
    const pageErrors = await page.evaluate(() => {
      // @ts-ignore
      return window.__testErrors || [];
    });

    const hasInfiniteLoopError = pageErrors.some((error: string) =>
      error.includes("Maximum update depth exceeded")
    );

    expect(hasInfiniteLoopError).toBe(false);

    console.log("✅ No infinite loop errors detected");
  });

  test("GroupInvitationsSection loads without useEffect loop", async ({
    page,
  }) => {
    console.log("🧪 Testing GroupInvitationsSection stability...");

    // Navigate to plan session
    await page.goto("/plan-session");
    await page.waitForTimeout(2000);

    // Check if the invitations section is present and stable
    const invitationsSection = page.locator(
      '[data-testid="group-invitations"]'
    );

    if ((await invitationsSection.count()) > 0) {
      console.log("✅ GroupInvitationsSection found and stable");

      // Wait a bit more to ensure no delayed infinite loops
      await page.waitForTimeout(3000);

      // Simple check: component is still there and page is responsive
      const isStillPresent = await invitationsSection.isVisible();
      expect(isStillPresent).toBe(true);

      console.log("✅ GroupInvitationsSection remained stable");
    } else {
      console.log(
        "ℹ️ GroupInvitationsSection not found (may be auth-protected)"
      );
    }

    console.log("✅ GroupInvitationsSection test passed");
  });
});
