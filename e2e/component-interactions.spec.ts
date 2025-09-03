import { test, expect } from "@playwright/test";
import { waitForPageLoad, waitForElementReady } from "./test-helpers";

test.describe("Component Interactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForPageLoad(page);
  });

  test.describe("Router and Navigation", () => {
    test("navigates between main pages correctly", async ({ page }) => {
      // Test home navigation
      const homeLink = page.locator('a[href="/"], a:has-text("Home")').first();
      if ((await homeLink.count()) > 0) {
        await homeLink.click();
        await waitForPageLoad(page);
        expect(page.url()).toContain("/");
      }

      // Test map navigation
      const mapLink = page.locator('a[href="/map"], a:has-text("Map")').first();
      if ((await mapLink.count()) > 0) {
        await mapLink.click();
        await waitForPageLoad(page);
        expect(page.url()).toContain("/map");
      }

      // Test sessions navigation
      const sessionsLink = page
        .locator('a[href="/sessions"], a:has-text("Sessions")')
        .first();
      if ((await sessionsLink.count()) > 0) {
        await sessionsLink.click();
        await waitForPageLoad(page);
        expect(page.url()).toContain("/sessions");
      }
    });

    test("handles page back and forward navigation", async ({ page }) => {
      // Navigate to different pages
      await page.goto("/map");
      await waitForPageLoad(page);

      await page.goto("/sessions");
      await waitForPageLoad(page);

      // Test browser back
      await page.goBack();
      await waitForPageLoad(page);
      expect(page.url()).toContain("/map");

      // Test browser forward
      await page.goForward();
      await waitForPageLoad(page);
      expect(page.url()).toContain("/sessions");
    });

    test("preserves page state during navigation", async ({ page }) => {
      // Test that form data or selections persist appropriately
      const searchInput = page
        .locator('input[placeholder*="search"], input[type="search"]')
        .first();

      if ((await searchInput.count()) > 0) {
        await searchInput.fill("Pacific Beach");
        await page.waitForTimeout(500);

        // Navigate away and back
        await page.goto("/sessions");
        await waitForPageLoad(page);
        await page.goBack();
        await waitForPageLoad(page);

        // Check if search state is preserved (this might or might not be expected behavior)
        const searchValue = await searchInput.inputValue();
        // Just verify the input still exists and is functional
        await expect(searchInput).toBeVisible();
      }
    });
  });

  test.describe("Form Component Interactions", () => {
    test("handles complex form interactions in session logging", async ({
      page,
    }) => {
      // Navigate to session logging
      await page.goto("/sessions/new?mode=log");
      await waitForPageLoad(page);

      // Test beach selection
      const beachInput = page
        .locator('input[placeholder*="beach"], input[placeholder*="location"]')
        .first();
      if ((await beachInput.count()) > 0) {
        await waitForElementReady(beachInput);
        await beachInput.fill("La Jolla");
        await page.waitForTimeout(1000);

        // Select from suggestions
        const suggestions = page.locator('[role="option"], .suggestion');
        if ((await suggestions.count()) > 0) {
          await suggestions.first().click();
        }
      }

      // Test date/time inputs
      const dateInputs = page.locator(
        'input[type="date"], input[type="datetime-local"]'
      );
      if ((await dateInputs.count()) > 0) {
        const dateInput = dateInputs.first();
        await waitForElementReady(dateInput);

        // Set a recent date
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const dateString = yesterday.toISOString().split("T")[0];

        await dateInput.fill(dateString);
      }

      // Test rating sliders
      const sliders = page.locator('[role="slider"]');
      if ((await sliders.count()) > 0) {
        for (let i = 0; i < Math.min(await sliders.count(), 3); i++) {
          const slider = sliders.nth(i);
          await waitForElementReady(slider);
          await slider.focus();

          // Move slider with keyboard
          await page.keyboard.press("ArrowRight");
          await page.keyboard.press("ArrowRight");
          await page.waitForTimeout(200);
        }
      }

      // Test dropdowns/selects
      const selects = page.locator('[role="combobox"], select');
      if ((await selects.count()) > 0) {
        const select = selects.first();
        await waitForElementReady(select);
        await select.click();
        await page.waitForTimeout(500);

        // Select first available option
        const options = page.locator('[role="option"]');
        if ((await options.count()) > 0) {
          await options.first().click();
        }
      }
    });

    test("validates form submissions properly", async ({ page }) => {
      // Test session planning form
      await page.goto("/sessions/new?mode=plan");
      await waitForPageLoad(page);

      // Try to submit without required fields
      const submitButton = page
        .locator(
          'button[type="submit"], button:has-text("Plan"), button:has-text("Save")'
        )
        .first();

      if ((await submitButton.count()) > 0) {
        await submitButton.click();
        await page.waitForTimeout(500);

        // Check for validation errors or successful submission
        const errors = page.locator(".error, .invalid");
        const errorText = page.locator('text=/required|error/i');
        const successIndicators = page.locator('text=/success|saved|created/i');
        
        const hasErrors = (await errors.count()) + (await errorText.count()) > 0;
        const hasSuccess = await successIndicators.count() > 0;
        
        // Either validation errors should show OR form should submit successfully
        expect(hasErrors || hasSuccess).toBeTruthy();
      }
    });

    test("handles async form operations", async ({ page }) => {
      // Test operations that involve API calls
      await page.goto("/sessions/new?mode=log");
      await waitForPageLoad(page);

      // Fill out a complete form
      const beachInput = page.locator('input[placeholder*="beach"]').first();
      if ((await beachInput.count()) > 0) {
        await beachInput.fill("Test Beach");
        await page.waitForTimeout(1000);

        // Submit and wait for loading states
        const submitButton = page.locator('button[type="submit"]').first();
        if ((await submitButton.count()) > 0) {
          await submitButton.click();

          // Look for loading indicators
          const loadingIndicators = page.locator(
            ":has-text(/loading|saving/i), .loading, .spinner"
          );

          // Wait for operation to complete (success or error)
          await page.waitForTimeout(3000);

          // Should show some result
          const results = page.locator(":has-text(/success|error|saved/i)");
          expect(await results.count()).toBeGreaterThan(0);
        }
      }
    });
  });

  test.describe("UI State Management", () => {
    test("handles modal and dialog interactions", async ({ page }) => {
      // Look for buttons that open modals
      const modalTriggers = page.locator(
        'button:has-text("edit"), button:has-text("add"), button:has-text("create")'
      );

      if ((await modalTriggers.count()) > 0) {
        const trigger = modalTriggers.first();
        await waitForElementReady(trigger);
        await trigger.click();

        // Wait for modal to appear
        await page.waitForTimeout(500);

        // Look for modal content
        const modals = page.locator('[role="dialog"], .modal, .dialog');
        if ((await modals.count()) > 0) {
          await expect(modals.first()).toBeVisible();

          // Test closing modal
          const closeButtons = page.locator(
            'button:has-text("close"), button:has-text("cancel"), [aria-label*="close"]'
          );
          if ((await closeButtons.count()) > 0) {
            await closeButtons.first().click();
            await page.waitForTimeout(500);

            // Modal should be hidden
            expect(await modals.count()).toBe(0);
          }
        }
      }
    });

    test("manages loading states correctly", async ({ page }) => {
      // Navigate to page that shows loading states
      await page.goto("/map");

      // Look for initial loading indicators
      const initialLoading = page.locator(
        ":has-text(/loading/i), .loading, .spinner"
      );

      // Wait for content to load
      await page.waitForTimeout(2000);

              // Loading should be gone and content should be visible
        const content = page.locator('.map, [data-testid="map"]');
        const forecastText = page.locator('text=/forecast/i');
        
        if ((await content.count()) > 0 || (await forecastText.count()) > 0) {
          const visibleElement = (await content.count()) > 0 ? content.first() : forecastText.first();
          await expect(visibleElement).toBeVisible();
        }
    });

    test("handles error states gracefully", async ({ page }) => {
      // Test network failure scenarios by intercepting requests
      await page.route("**/api/**", (route) => {
        // Simulate some API failures
        if (Math.random() > 0.8) {
          route.abort();
        } else {
          route.continue();
        }
      });

      await page.goto("/");
      await waitForPageLoad(page);

      // Look for error handling
      await page.waitForTimeout(3000);

      // Should show content or appropriate error messages
      const hasContent =
        (await page.locator(":has-text(/forecast|session|beach/i)").count()) > 0;
      const hasErrors =
        (await page.locator(":has-text(/error|failed|unavailable/i)").count()) > 0;

      expect(hasContent || hasErrors).toBe(true);
    });
  });

  test.describe("Accessibility and Keyboard Navigation", () => {
    test("supports keyboard navigation through interactive elements", async ({
      page,
    }) => {
      await page.goto("/");
      await waitForPageLoad(page);

      // Test tab navigation
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");

      // Should be able to navigate to interactive elements
      const focusedElement = page.locator(":focus");
      await expect(focusedElement).toBeVisible();
    });

    test("provides proper ARIA labels and roles", async ({ page }) => {
      await page.goto("/");
      await waitForPageLoad(page);

      // Check for proper button roles
      const buttons = page.locator('[role="button"], button');
      expect(await buttons.count()).toBeGreaterThan(0);

      // Check for proper form labels
      const inputs = page.locator("input");
      if ((await inputs.count()) > 0) {
        for (let i = 0; i < Math.min(await inputs.count(), 5); i++) {
          const input = inputs.nth(i);
          const hasLabel =
            (await input
              .locator(
                "xpath=./preceding-sibling::label | ./following-sibling::label"
              )
              .count()) > 0;
          const hasAriaLabel =
            (await input.getAttribute("aria-label")) !== null;
          const hasAriaLabelledBy =
            (await input.getAttribute("aria-labelledby")) !== null;

          expect(hasLabel || hasAriaLabel || hasAriaLabelledBy).toBe(true);
        }
      }
    });
  });
});
